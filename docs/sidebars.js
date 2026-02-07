/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/installation', 'getting-started/quick-start'],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/core',
        'api/hooks',
        'api/components',
        'api/devtools',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/how-it-works',
        'architecture/stutter-detection',
      ],
    },
  ],
};

module.exports = sidebars;
