/**
 * Every string, number and link on the page lives here.
 * Copy is a first draft for Nevo to rewrite; numbers carry their source.
 */
import mrrData from '../data/mrr.json';

// ---------------------------------------------------------------------------
// Proof. One source for the headline number, so it cannot drift from Stripe.
// ---------------------------------------------------------------------------

const lastPoint = mrrData.points[mrrData.points.length - 1];

export const proof = {
  /** MRR on the Stripe card, in dollars. */
  mrr: lastPoint.mrr,
  /** ISO date the MRR figure was read. */
  asOf: lastPoint.date,
  /**
   * TODO before launch: replace with a fresh Stripe proof link.
   * This one is the snapshot from the Aug 21 article and shows an older figure.
   */
  stripeUrl: 'https://profile.stripe.com/@wickedguro/m/QMYOzV3C',
  raised: '$0',
  founders: 1,
  platforms: '30+',
  articleViews: '895K',
};

const arr = proof.mrr * 12;

/**
 * PLAN.md decision D1: the page says "$3M ARR" only once Stripe MRR reaches $250k.
 * Until then it states the real figure, rounded down to one decimal.
 */
export const arrShort = arr >= 3_000_000 ? '$3M' : `$${(Math.floor(arr / 100_000) / 10).toFixed(1)}M`;
export const arrLabel = `${arrShort} ARR`;
export const asOfLabel = new Date(`${proof.asOf}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

// ---------------------------------------------------------------------------
// Install names. Mocks until the real skill repo and MCP server exist.
// ---------------------------------------------------------------------------

export const install = {
  /** True while the names below are placeholders. The launch check fails on it. */
  mock: true,
  skillRepo: 'gitroomhq/nevos-brain',
  serverName: 'nevos-brain',
  mcpUrl: 'https://nevo.md/mcp',
  skillUrl: 'https://nevo.md/SKILL.md',
  /** Hides the MCP tab until the server is up. */
  mcpLive: true,
};

export const skillCommand = `npx skills add ${install.skillRepo}`;

const mcpJson = JSON.stringify({ mcpServers: { [install.serverName]: { url: install.mcpUrl } } }, null, 2);

const cursorDeeplink =
  'cursor://anysphere.cursor-deeplink/mcp/install?name=' +
  encodeURIComponent(install.serverName) +
  '&config=' +
  encodeURIComponent(Buffer.from(JSON.stringify({ url: install.mcpUrl })).toString('base64'));

export type McpAgent = {
  id: string;
  label: string;
  /** Shown above the box when the value is not a plain shell command. */
  note?: string;
  /** The same in one line, for the small install block in the hero. Defaults to the note. */
  short?: string;
  value: string;
  steps?: string[];
  deeplink?: { label: string; href: string };
};

/** One entry per agent. Each line was checked against the agent's CLI help or docs (PLAN.md section 5). */
export const mcpAgents: McpAgent[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    value: `claude mcp add --transport http ${install.serverName} ${install.mcpUrl}`,
  },
  {
    id: 'claude',
    label: 'Claude',
    note: 'On the web or desktop app:',
    short: 'Customize, Connectors, +, “Add custom connector”, then paste this URL.',
    steps: ['Open Customize, then Connectors.', 'Click +, then “Add custom connector”.', 'Paste this URL and click Add.'],
    value: install.mcpUrl,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    note: 'Add this to ~/.cursor/mcp.json',
    short: 'Goes in ~/.cursor/mcp.json.',
    value: mcpJson,
    deeplink: { label: 'Add to Cursor', href: cursorDeeplink },
  },
  {
    id: 'codex',
    label: 'Codex',
    value: `codex mcp add ${install.serverName} --url ${install.mcpUrl}`,
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    value: `openclaw mcp add ${install.serverName} --url ${install.mcpUrl} --transport streamable-http`,
  },
  {
    id: 'hermes',
    label: 'Hermes',
    value: `hermes mcp add ${install.serverName} --url ${install.mcpUrl}`,
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    value: `gemini mcp add --transport http ${install.serverName} ${install.mcpUrl}`,
  },
  {
    id: 'other',
    label: 'Other',
    note: 'Most MCP clients accept this config:',
    short: 'Most MCP clients accept this config.',
    value: mcpJson,
  },
];

export const skillAlternatives = [
  { label: 'OpenClaw', value: `openclaw skills install git:${install.skillRepo}` },
  { label: 'Hermes', value: `hermes skills install ${install.skillUrl}` },
  { label: 'Gemini CLI', value: `gemini skills install https://github.com/${install.skillRepo}` },
];

export const tellYourAgent = `Install the skill at ${install.skillUrl} and use it whenever I ask about marketing, distribution or growth.`;

export const worksWith = ['Claude Code', 'Claude', 'Cursor', 'Codex', 'OpenClaw', 'Hermes', 'Gemini CLI'];

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const links = {
  x: 'https://x.com/wickedguro',
  postiz: 'https://postiz.com',
  agentMedia: 'https://agent-media.ai',
  github: 'https://github.com/gitroomhq',
};

const article = (id: string) => `https://x.com/wickedguro/status/${id}`;

export const playbooks = [
  { title: 'Paperclip runs my marketing, it feels ILLEGAL', date: 'Apr 1, 2026', views: '543.6K', href: article('2039344437374156948') },
  { title: 'Postiz crossed $2M ARR while everybody says SaaS is dead', date: 'Aug 10, 2026', views: '206.4K', href: article('2086788813301661865') },
  { title: 'Postiz reached $100k MRR', date: 'May 15, 2026', views: '78.9K', href: article('2055279858767552604') },
  { title: 'If I wanted to go from $0 to $250k in 12 months, here’s what I’d do', date: 'Mar 5, 2026', views: '30.2K', href: article('2029580709846020364') },
  { title: 'How I would pick a startup idea in 2026', date: 'Aug 21, 2026', views: '21.9K', href: article('2090778859352563921') },
  { title: 'How I reached $20k MRR with my social media scheduler (full playbook)', date: 'Feb 14, 2026', views: '12.7K', href: article('2022361200932315279') },
  { title: 'How I took monthly revenue from $15k to $18k with no extra traffic', date: 'Jan 30, 2026', views: '928', href: article('2017216658251673996') },
  { title: 'I took my scheduler from $15k to $17k MRR with zero new features', date: 'Jan 13, 2026', views: '720', href: article('2010946319318413692') },
];

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const meta = {
  title: 'Nevo’s Brain: the distribution playbook for your AI agent',
  description:
    'A free SKILL file and MCP server that give your AI agent the distribution playbook behind Postiz: finding niches, catching hypes, picking channels and growing revenue.',
};

export const hero = {
  title: 'Your agent can build anything. Now teach it to sell.',
  sub: 'Nevo’s Brain is a SKILL file and an MCP server that plug the distribution playbook behind Postiz into your agent: how to find a niche, catch a hype early, pick the channel, and grow the number.',
  free: 'Free. No signup. One command.',
};

export type Ability = {
  id: string;
  /** The handwritten name of the ability; also labels its node beside the brain. */
  name: string;
  title: string;
  body: string;
  ask: { prompt: string; bullets: string[]; source: { label: string; href: string } };
  receipt: {
    label: string;
    value: string;
    note: string;
    /** The stretch of the MRR line this receipt is about, as ISO dates. */
    from: string;
    to: string;
    /** The period the small chart shows around that stretch. */
    window: [string, string];
    source: { label: string; href: string };
  };
};

export const abilities: Ability[] = [
  {
    id: 'niches',
    name: 'Niche radar',
    title: 'Finds the audience nobody is serving.',
    body: 'New ideas need marketing money you don’t have. The brain starts from ideas that already make money, then looks for the people the big players ignore. Buffer and Sprout sell to marketers. Postiz sold to developers.',
    ask: {
      prompt: 'Find me an underserved audience for an invoicing tool.',
      bullets: [
        'Start from a category people already pay for. Skip the idea nobody searches for.',
        'List who the leaders sell to, then who they leave out.',
        'Check churn before you build. Tools that hold data keep their customers.',
      ],
      source: { label: 'How I would pick a startup idea in 2026', href: article('2090778859352563921') },
    },
    receipt: {
      label: 'MRR from an audience Buffer never sold to',
      value: '$20k',
      note: 'Developers and self-hosters, before agents existed.',
      from: '2024-09-01',
      to: '2026-02-01',
      window: ['2024-09-01', '2026-02-01'],
      source: { label: 'Aug 21 article', href: article('2090778859352563921') },
    },
  },
  {
    id: 'hypes',
    name: 'Hype antenna',
    title: 'Catches the wave before it gets crowded.',
    body: 'n8n, then MCP, then agents. Each time the move was the same: ship something that rides the wave without betting the company on it, then make a launch out of it.',
    ask: {
      prompt: 'What is getting hyped right now that I could ship a feature around this week?',
      bullets: [
        'Pick a wave your product sits next to, not one you would have to become.',
        'Ship the smallest thing that plugs into it: a node, an MCP, a skill.',
        'Make it an event: a launch, an article, a short video.',
      ],
      source: { label: 'How I reached $20k MRR (full playbook)', href: article('2022361200932315279') },
    },
    receipt: {
      label: 'MRR in three months on the agent wave',
      value: '$20k to $100k',
      note: 'February to May 2026. 2,000 new customers in one of those months.',
      from: '2026-02-01',
      to: '2026-06-01',
      window: ['2025-08-01', '2026-06-01'],
      source: { label: 'May 15 article', href: article('2055279858767552604') },
    },
  },
  {
    id: 'tactics',
    name: 'Tactics board',
    title: 'Knows which channels work this year.',
    body: 'Ads and classic SEO keep getting harder. Authority, X articles, answer engines, lead magnets and UGC are where the growth is now, and each has rules: what the algorithm rewards, when to repeat, when to stop.',
    ask: {
      prompt: 'Plan the Reddit launch for my open-source repo.',
      bullets: [
        'Lead with the repo, not the product. Reddit tolerates self-promotion when it is open source.',
        'Post every release to r/selfhosted and Lemmy, not only the first one.',
        'When a post works, repeat the format until it stops working.',
      ],
      source: { label: 'How I reached $20k MRR (full playbook)', href: article('2022361200932315279') },
    },
    receipt: {
      label: 'MRR in one month, from one outreach campaign',
      value: '$6k to $12k',
      note: 'August 2025. Emails to the owners of n8n communities, with free lifetime deals.',
      from: '2025-08-01',
      to: '2025-09-01',
      window: ['2025-01-01', '2025-12-01'],
      source: { label: 'Feb 14 article', href: article('2022361200932315279') },
    },
  },
  {
    id: 'growth',
    name: 'Growth engine',
    title: 'Grows the number without more traffic.',
    body: 'Same trials, more revenue. Checkout on one page, a video before the paywall, streak emails, and the churn fix that mattered most: selling to people whose work is done by machines.',
    ask: {
      prompt: 'My trial-to-paid is 8%. What do I fix first?',
      bullets: [
        'Show what it does before the card form. A short video beats a feature list.',
        'Put plans and payment on one page. Every redirect loses people.',
        'Then fix churn: find the customers who stay and sell to more of them.',
      ],
      source: { label: 'From $15k to $18k with no extra traffic', href: article('2017216658251673996') },
    },
    receipt: {
      label: 'MRR in one month, same number of trials',
      value: '$15k to $18k',
      note: 'January 2026. No new traffic and no new features.',
      from: '2025-12-01',
      to: '2026-02-01',
      window: ['2025-08-01', '2026-02-01'],
      source: { label: 'Jan 30 article', href: article('2017216658251673996') },
    },
  },
];

/**
 * The middle of each ability's section, between its text and its drawing: a different picture
 * for each (components/panels/). The numbers and their sources come from the ability's receipt
 * and ask above; these are only the words around them.
 */
export const panels = {
  niches: {
    crowdTitle: 'the big players',
    crowd: 'Like Buffer and Sprout Social: all selling to marketers.',
    foundTitle: 'Postiz went here',
  },
  hypes: {
    /** Each wave, and the small thing Postiz shipped to ride it. */
    waves: [
      { name: 'n8n', shipped: 'Shipped a node' },
      { name: 'MCP', shipped: 'Shipped an MCP server' },
      { name: 'Agents', shipped: 'Shipped a skill' },
    ],
  },
  tactics: {
    /** The channels named in the section's own text. */
    working: ['Authority', 'X articles', 'Answer engines', 'Lead magnets', 'UGC'],
    harder: ['Ads', 'Classic SEO'],
    rulesTitle: 'The rules for one of them: Reddit',
    rules: ['Lead with the repo, not the product.', 'Post every release, not only the first.', 'Repeat a post that works until it stops working.'],
    /** $6k to $12k. */
    multiple: '2×',
    campaign: 'one outreach campaign',
  },
  growth: {
    period: 'January 2026',
    /** MRR before and after, as the article states them. */
    before: 15_000,
    after: 18_000,
  },
};

/**
 * Nevo at the bottom of each ability's section (components/NevoAct.astro): which of his scenes
 * with the brain it shows, played by the scroll. The names are the files in assets/scenery.
 */
export const nevoActs = {
  niches: 'scan',
  hypes: 'surf',
  tactics: 'coach',
  growth: 'grow',
} as const;

export const meetNevo = {
  title: 'It all came out of one head.',
  body: [
    `I’m Nevo. I built Postiz alone, with no investors, from a project stuck at $3k MRR to ${arrLabel}.`,
    'Before that I ran growth at a startup, sold a LinkedIn outreach tool, and ran a consultancy growing open-source repos. Everything that worked is in the brain, and I add to it every time something new does.',
  ],
  callout: 'Nevo’s brain',
};

export const proofSection = {
  title: 'Every play has a receipt.',
  sub: 'The revenue is public and verified by Stripe. This chart is redrawn from that data, and the link goes to the original.',
  chartTitle: 'Postiz monthly recurring revenue',
  stripeLink: 'Verified on Stripe',
  annotations: [
    { date: '2024-09-01', text: 'open-source launch', dx: 12, dy: -46 },
    { date: '2025-08-15', text: 'one outreach campaign', dx: -150, dy: -62 },
    { date: '2026-02-01', text: 'agents arrive', dx: -128, dy: -70 },
  ],
  bubbles: [
    { value: arrShort, label: 'ARR', size: 'l' },
    { value: proof.raised, label: 'raised', size: 'm' },
    { value: String(proof.founders), label: 'founder', size: 's' },
    { value: proof.platforms, label: 'platforms', size: 'm' },
    { value: proof.articleViews, label: 'article views', size: 'm' },
  ],
};

export const howItWorks = {
  title: 'How Nevo’s Brain works',
  steps: [
    { title: 'Connect it', text: 'Add the skill or the MCP server. One command, no account.' },
    { title: 'Ask it', text: 'Your agent consults the brain whenever the task is growth: an idea, a niche, a launch, a pricing page.' },
    { title: 'Ship it', text: 'It answers with the play and the numbers behind it. Your agent does the work.' },
  ],
};

export const faq = [
  {
    q: 'What exactly is it?',
    a: 'A SKILL file and an MCP server. Both give your agent the same thing: my playbooks for finding a niche, catching a hype, picking channels and growing revenue, written from what worked on Postiz.',
  },
  {
    q: 'Which agents does it work with?',
    a: 'Anything that reads a SKILL.md or speaks MCP. That covers Claude Code, Claude, Cursor, Codex, OpenClaw, Hermes, Gemini CLI and most others.',
  },
  {
    q: 'How is this different from asking ChatGPT for marketing advice?',
    a: 'A general model gives you the average of the internet. This is one person’s playbook with the numbers attached: what I did, in what order, and what it moved.',
  },
  {
    q: 'Is it only for SaaS?',
    a: 'It was learned on a SaaS, but distribution is distribution. If you sell something online and need people to find it, most of it applies.',
  },
  {
    q: 'How often is it updated?',
    a: 'Every time I publish a new playbook. The MCP always has the latest. The skill updates when you run npx skills update.',
  },
  {
    q: 'Do I need Postiz?',
    a: 'No. The brain tells your agent what to do. If what it needs to do is post, Postiz is what I use.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. No card, no signup, no key.',
  },
  {
    q: 'Why is it free?',
    a: 'Because I would rather you know who I am the day you need a scheduler.',
  },
];

export const finalCta = {
  title: 'Nevo’s brain never sleeps',
};
