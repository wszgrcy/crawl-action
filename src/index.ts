import * as core from '@actions/core';
import { FullWebRequest } from '@cyia/crawl';
let API_KEY = process.env['API_KEY'];
if (!API_KEY) {
  throw new Error('没有读取到apikey');
}
export async function main() {
  const urlList = process.env['URL']!.split(/\n|\r\n|,/);
  console.log('url', urlList);

  //   const mode = core.getInput('mode', { required: true });

  for (const item of urlList) {
    let rootUrl = new URL(item);
    let instance = new FullWebRequest({
      rootUrl: item,
      filterLink: async (url) => {
        return new URL(url).origin === rootUrl.origin;
      },
      queueList: async (url) => {
        return [
          { type: 'setViewport', width: 1920, height: 1080 },
          { type: 'goto', url: url, waitUntil: 'networkidle0' },
        ];
      },
    });
    instance.data$.subscribe(async (data: any) => {
      const BASE_URL = 'http://lan-server.chloc:4123';

      const url = `${BASE_URL}/open/docVector/convertUrlDoc`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            data: data || {},
          }),
        });

        if (!response.ok) {
          let errorDetail;
          try {
            const errText = await response.text();
            errorDetail = errText ? `\nBody: ${errText}` : '';
          } catch (_) {}

          throw new Error(`Request failed with status ${response.status}${errorDetail}`);
        }

        const result = await response.json();
        console.log('成功', url);
        return result;
      } catch (error) {
        console.log(error);
      }
    });
    await instance.start({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } as any);
    console.log('运行完成');
  }
}
main();
