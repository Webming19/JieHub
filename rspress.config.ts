import * as path from 'node:path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  globalStyles: path.join(__dirname, 'src/styles/index.css'),
  title: '杰哥资料站',
  description: '杰哥分享的文章、录音、聊天记录等',
  icon: '/jiege-logo.webp',
  logo: '/jiege-logo.webp',
  themeConfig: {
    socialLinks: [
      {
        icon: 'bilibili',
        mode: 'link',
        content: 'https://space.bilibili.com/3546574294616231',
      },
    ],
    prevPageText: '上一篇',
    nextPageText: '下一篇',
  },
});
