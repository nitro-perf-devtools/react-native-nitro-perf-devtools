// @ts-check
const { themes: prismThemes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'NitroPerf',
  tagline: 'Hybrid performance monitor for React Native',
  favicon: 'img/favicon.ico',
  url: 'https://nitroperf-docs.fly.dev',
  baseUrl: '/',
  organizationName: 'nitro-perf-devtools',
  projectName: 'react-native-nitro-perf-devtools',
  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/nitro-perf-devtools/react-native-nitro-perf-devtools/tree/main/docs/',
        },
        blog: {
          showReadingTime: true,
          onInlineAuthors: 'ignore',
          authorsMapPath: 'authors.yml',
          editUrl: 'https://github.com/nitro-perf-devtools/react-native-nitro-perf-devtools/tree/main/docs/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      announcementBar: {
        id: 'free_palestine',
        content: '🇵🇸 Free Palestine',
        backgroundColor: '#009736',
        textColor: '#fff',
        isCloseable: false,
      },
      navbar: {
        title: 'NitroPerf',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            href: 'https://github.com/nitro-perf-devtools/react-native-nitro-perf-devtools',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Introduction', to: '/docs/' },
              { label: 'Getting Started', to: '/docs/getting-started/installation' },
              { label: 'API Reference', to: '/docs/api/core' },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/nitro-perf-devtools/react-native-nitro-perf-devtools',
              },
              {
                label: 'npm — @nitroperf/core',
                href: 'https://www.npmjs.com/package/@nitroperf/core',
              },
            ],
          },
          {
            title: 'More',
            items: [
              { label: 'Blog', to: '/blog' },
              {
                label: 'Nitro Modules',
                href: 'https://github.com/mrousavy/nitro',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} NitroPerf. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'typescript', 'json'],
      },
    }),
};

module.exports = config;
