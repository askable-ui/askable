import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsRoot = resolve(__dirname, '..')
const versions = JSON.parse(readFileSync(resolve(docsRoot, 'versions.json'), 'utf8')) as {
  current: { label: string; slug: string }
  archived: Array<{ label: string; slug: string }>
}
const docsBase = process.env.ASKABLE_DOCS_BASE ?? '/docs/'
const docsOrigin = process.env.ASKABLE_DOCS_SITE_ORIGIN ?? 'https://askable-ui.com'
const currentVersion = versions.current
const archivedVersions = versions.archived ?? []
const latestDocsUrl = `${docsOrigin}/docs/`
const versionedDocsUrl = (slug: string) => `${docsOrigin}/docs/${slug}/`
const versionItems = [
  { text: `Latest docs (${currentVersion.label})`, link: latestDocsUrl },
  { text: `${currentVersion.label} docs`, link: versionedDocsUrl(currentVersion.slug) },
  ...archivedVersions.map((version) => ({ text: version.label, link: versionedDocsUrl(version.slug) })),
  { text: 'Migration guides', link: '/guide/migrations' },
  { text: 'Changelog', link: 'https://github.com/askable-ui/askable/releases' },
  { text: 'npm', link: 'https://www.npmjs.com/package/@askable-ui/core' },
]

export default defineConfig({
  base: docsBase,
  title: 'askable-ui',
  description: 'UI context your LLM can actually use. Annotate elements with data-askable and feed structured focus context into any AI assistant.',
  head: [
    ['link', { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'><rect width=\'32\' height=\'32\' rx=\'9\' fill=\'%23111317\'/><text x=\'16\' y=\'22\' font-family=\'system-ui,sans-serif\' font-size=\'18\' font-weight=\'900\' fill=\'white\' text-anchor=\'middle\'>✦</text></svg>' }],
  ],
  themeConfig: {
    logo: { src: '/avatar.png', alt: 'askable-ui' },
    siteTitle: 'askable-ui',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API Reference', link: '/api/core', activeMatch: '/api/' },
      { text: 'Examples', link: '/examples/dashboard', activeMatch: '/examples/' },
      {
        text: currentVersion.label,
        items: versionItems,
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is askable-ui?', link: '/guide/' },
            { text: 'What’s New in v6.1.0', link: '/guide/whats-new' },
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
            { text: 'Migration Guides', link: '/guide/migrations' },
            { text: 'SSR Safety', link: '/guide/ssr' },
            { text: 'Browser Support', link: '/guide/browser-support' },
          ],
        },
        {
          text: 'Integrations',
          items: [
            { text: 'Third-Party Libraries', link: '/guide/third-party-libraries' },
            { text: 'CopilotKit', link: '/guide/copilotkit' },
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
            { text: '@askable-ui/react-native', link: '/api/react-native' },
            { text: '@askable-ui/vue', link: '/api/vue' },
            { text: '@askable-ui/svelte', link: '/api/svelte' },

          ],
        },
        {
          text: 'Types',
          items: [
            { text: 'Type Reference', link: '/api/types' },
            { text: 'Docs Versioning', link: '/api/versioning' },
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
