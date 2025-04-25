import * as path from 'node:path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  title: '杰哥文章',
  description: '杰哥文章',
  icon: '/jiege-logo.webp',
  // logo: '/jiege-logo.webp',
  themeConfig: {
    socialLinks: [
      {
        icon: 'bilibili',
        mode: 'link',
        content: 'https://space.bilibili.com/3546574294616231',
      },
    ],
  },
});
