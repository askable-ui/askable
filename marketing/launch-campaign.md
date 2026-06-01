# Askable launch campaign

## Positioning

Askable makes application UI understandable to chat agents. Developers can mark elements, lasso regions, circle details, capture selected text, and include app-owned sources such as full tables or documents as explicit context.

Primary message:

> Stop asking users to describe the screen. Let them point, select, circle, or lasso the exact UI context the agent should use.

One-line tagline options:

- UI context your model can actually use.
- Point at your app. Askable turns it into agent context.
- Selection, lasso, and app state for AI chat.
- The UI context layer for AI-native applications.

## Launch assets

- Website: `https://askable-ui.com`
- GitHub: `https://github.com/askable-ui/askable`
- Docs: `https://askable-ui.com/docs/`
- Demo video page: `site/www/launch-video.html`
- Existing social image: `site/www/social.png`
- Existing demo GIF: `site/www/demo.gif`

## Product Hunt draft

Name:

Askable UI

Tagline:

Turn UI selections, regions, and app state into AI-ready context.

Short description:

Askable UI is an open source context layer for AI-native apps. Add click, hover, text selection, circle, lasso, and app-owned data sources so chat agents know exactly what the user is pointing at.

Maker comment:

We built Askable UI because AI chat inside apps still depends on users explaining what is already on screen.

The missing primitive is explicit UI context. A user should be able to click a row, highlight text, circle a chart point, or lasso a dashboard area and have the agent receive structured, consented context. For richer cases, the app can also register sources such as the full table, current document, filters, route, or selected objects.

Askable UI gives developers that layer across React, Vue, Svelte, React Native, and plain JavaScript. It includes UI annotations, interaction capture, structured Context packets, prompt serialization, MCP support, and dev tooling for inspecting what will be sent.

We are launching this as open source because this should become a normal interaction pattern for AI-native software, not a one-off widget in every app.

I would love feedback from builders working on copilots, internal tools, dashboards, support tooling, and browser agents: what context do your users still have to explain manually today?

Gallery shot ideas:

- Hero: "Point, lasso, select. Your agent gets the context."
- Interaction modes: click, hover, text selection, circle, lasso.
- App-owned sources: visible selection plus full table/document context.
- Protocol angle: structured Context packet from UI to chat/MCP.
- Frameworks: React, Vue, Svelte, React Native, vanilla JS.

Topics:

- Artificial Intelligence
- Developer Tools
- Open Source
- Productivity
- SaaS

## Launch sequence

T-minus 14 days:

- Publish the demo video page and record a 45-60 second launch video.
- Make the README first screen explain the "point at UI -> context for agent" loop.
- Add 3 short demos: dashboard lasso, text selection, app source/full table.
- Build a list of 50 direct contacts: AI app builders, devtool founders, internal tooling teams, OSS maintainers, and MCP/browser-agent builders.
- Ask 10 trusted builders for landing page and demo feedback before announcing.

T-minus 7 days:

- Schedule the Product Hunt launch from a personal maker account.
- Prepare 5 gallery images and 1 video.
- Prepare X, LinkedIn, Hacker News, Reddit, and Discord posts.
- Prepare a launch blog post: "UI context is the missing primitive for AI-native apps."
- Confirm npm package pages, GitHub README, docs, examples, and website all point to the same current version.

Launch day:

- Post at the start of the Product Hunt day.
- Add the maker comment immediately.
- Share the Product Hunt link through personal channels without asking for blind upvotes. Ask for feedback.
- Reply to every useful comment quickly.
- Post the demo video natively on X and LinkedIn, not only as a link.
- Pin the GitHub repo announcement and link to docs.

Post-launch:

- Publish a launch recap with concrete learnings and roadmap.
- Convert common Product Hunt questions into docs.
- Open GitHub issues for repeated feature requests.
- Turn the best demo into the website hero asset.

## Social copy

X short:

AI chat in apps should not make users explain the screen.

Askable UI lets users click, select text, circle, or lasso UI context, then sends structured context to the agent.

Open source. React, Vue, Svelte, React Native, and vanilla JS.

X technical:

Most copilots know the user typed a question, but not what they are looking at.

Askable UI adds:
- UI annotations
- click/hover focus
- text selection
- circle/lasso capture
- app-owned context sources
- structured packets for chat/MCP

LinkedIn:

We are launching Askable UI, an open source context layer for AI-native applications.

The core idea is simple: users should not have to describe the UI they are already looking at. They should be able to click an object, highlight text, circle a chart point, or lasso part of the screen, and the chat agent should receive structured context with clear provenance.

Askable UI gives product teams the building blocks for that interaction pattern across modern web stacks.

Hacker News:

Show HN: Askable UI - open source UI context for AI chat agents

I built Askable UI to solve a problem I kept seeing in app copilots: the user asks about something on screen, but the model only sees the text prompt unless the app builds custom context plumbing.

Askable lets developers mark UI, capture selected regions/text, and register app-owned sources so agents can receive structured context about what the user meant.

## Submission notes

Product Hunt currently requires a personal account to post a product. The product page should be scheduled from the maker account so comments, maker identity, and launch notifications are controlled by the founder.

Reference links:

- Product Hunt launch guide: https://www.producthunt.com/launch
- Product Hunt help, how to post a product: https://help.producthunt.com/en/articles/479557-how-to-post-a-product
