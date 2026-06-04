import * as core from '@actions/core';
import { buildMarkdownMap, FullWebRequest } from '@cyia/crawl';
import { createRootInjector } from 'static-injector';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { ZipService } from '@cyia/zip';
import sanitize from 'sanitize-filename';
import { v4 } from 'uuid';

export async function main() {
  const urlList = process.env['INPUT_URL']!.split(/\n|\r\n|,/);
  let tags = process.env['INPUT_TAGS']!.split(/\n|\r\n|,/);
  let skipQueryParams = process.env['skipQueryParams'] === 'true';
  console.log('url', urlList);
  let injector = createRootInjector({ providers: [ZipService] });
  let zip = injector.get(ZipService);
  for (let index = 0; index < urlList.length; index++) {
    const item = urlList[index];

    let rootUrl = new URL(item);
    let instance = new FullWebRequest({
      rootUrl: item,
      filterLink: async (url) => {
        let url2 = new URL(url);
        if (skipQueryParams && url2.search) {
          return false;
        }
        return url.startsWith(item);
      },
      queueList: async (url) => {
        return [
          { type: 'setViewport', width: 1920, height: 1080 },
          { type: 'goto', url: url, waitUntil: 'networkidle0' },
          { type: 'wait', config: { mode: 'delay', value: 2000 } },
        ];
      },
    });

    let result = await instance.start({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--lang=zh-CN'],
    } as any);
    let data = buildMarkdownMap(item, result);
    let list = [];
    let dir = path.join(process.cwd(), '.doc-tmp', v4());
    for (const [key, value] of data.entries()) {
      let fp = path.join(dir, key);
      let fdir = path.dirname(fp);
      list.push(
        (() => {
          return fs.mkdir(fdir, { recursive: true }).then(() => {
            return fs.writeFile(fp === fdir ? path.join(fp, 'index.md') : fp, value);
          });
        })(),
      );
    }
    await Promise.all(list);
    await fs.mkdir(path.join(process.cwd(), 'output'));
    const outputPath = path.join(process.cwd(), 'output', sanitize(tags[index] || item.replace(/^https?:\/\//, ''), { replacement: '_' }));
    await zip.zip(dir, outputPath);
    console.log(`拉取`, item, '完成');
    // 压缩完成后,读取下output,然后打印一下里面的文件名
    const outputDir = path.dirname(outputPath);
    const files = await fs.readdir(outputDir);
    console.log('output dir:', outputDir);
    console.log('files:', files);
  }
}
main();
