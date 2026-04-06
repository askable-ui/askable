import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/askable/docs/',
  title: 'askable-ui',
  description: 'UI context your LLM can actually use. Annotate elements with data-askable and feed structured focus context into any AI assistant.',
  head: [
    ['link', { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><rect width=\'32\' height=\'32\' rx=\'9\' fill=\'%23111317\'/><text x=\'16\' y=\'22\' font-family=\'system-ui,sans-serif\' font-size=\'18\' font-weight=\'900\' fill=\'white\' text-anchor=\'middle\'>✦</text></svg>' }],
  ],
  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: 'askable-ui' },
    siteTitle: 'askable-ui',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API Reference', link: '/api/core', activeMatch: '/api/' },
      { text: 'Examples', link: '/examples/dashboard', activeMatch: '/examples/' },
      {
        text: 'v0.2.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/askable-ui/askable/releases' },
          { text: 'npm', link: 'https://www.npmjs.com/package/@askable-ui/core' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is askable-ui?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'How It Works', link: '/guide/how-it-works' },
          ],
        },
        {
          text: 'Framework Guides',
          items: [
            { text: 'React', link: '/guide/react' },
            { text: 'Vue', link: '/guide/vue' },
            { text: 'Svelte', link: '/guide/svelte' },
            { text: 'Plain JS / HTML', link: '/guide/vanilla' },
          ],
        },
        {
          text: 'Concepts',
          items: [
            { text: 'Annotating Elements', link: '/guide/annotating' },
            { text: 'Focus & History', link: '/guide/focus-history' },
            { text: 'Ask AI Buttons (select())', link: '/guide/select' },
            { text: 'Prompt Serialization', link: '/guide/serialization' },
            { text: 'SSR Safety', link: '/guide/ssr' },
            { text: 'Browser Support', link: '/guide/browser-support' },
          ],
        },
        {
          text: 'Integrations',
          items: [
            { text: 'CopilotKit', link: '/guide/copilotkit' },
            { text: 'Python Packages', link: '/guide/python' },
          ],
        },
        {
          text: 'Tooling',
          items: [
            { text: 'Inspector / Dev Panel', link: '/guide/inspector' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: '@askable-ui/core', link: '/api/core' },
            { text: '@askable-ui/react', link: '/api/react' },
            { text: '@askable-ui/vue', link: '/api/vue' },
            { text: '@askable-ui/svelte', link: '/api/svelte' },

          ],
        },
        {
          text: 'Python',
          items: [
            { text: 'askable-shared (serializer)', link: '/api/python-shared' },
          ],
        },
        {
          text: 'Types',
          items: [
            { text: 'Type Reference', link: '/api/types' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Dashboard Assistant', link: '/examples/dashboard' },
            { text: 'AI SDK Integration', link: '/examples/ai-sdk' },
            { text: 'CopilotKit', link: '/examples/copilotkit' },
            { text: 'Ask AI Button', link: '/examples/ask-ai-button' },
            { text: 'Python (Django / Streamlit)', link: '/examples/python' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/askable-ui/askable' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@askable-ui/core' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024–present askable-ui',
    },

    editLink: {
      pattern: 'https://github.com/askable-ui/askable/edit/main/site/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
})
