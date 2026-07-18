# The Application Track

Use this instead of Phases 1-2 and the build half of Phase 5 when the thing being built is
an **application** rather than a marketing page: a forum, a dashboard, an admin panel, a
booking system, a community site, a documentation portal, a chat app, a store front-end.

The rest of the pipeline is unchanged. Discovery, imagery, the asset pipeline, the failure
gates, verification, deploy and git are all shared. **Only the design source and the build
architecture differ.**

---

## 1. Which track is this?

| Signal | Marketing track | Application track |
|---|---|---|
| The user's goal | persuade a visitor | let a user *do* something |
| The page is finished when | they scroll and convert | they complete a task |
| Content | fixed, authored | dynamic, repeating, user-generated |
| Structure | a vertical sequence of sections | routes, states and components |
| Success metric | conversion | task completion |

**Test:** ask "does this thing have a *logged-in* state, a list of user-created records, or
a form that changes stored data?" If yes, application track.

**Mixed is normal.** A forum has a marketing home page *and* the forum itself. A SaaS has a
landing page *and* a dashboard. Run the marketing track for the public surface and this
track for the product surface. Say which you are doing.

---

## 2. Phase 1-A: inventory, not sections

A marketing page is a vertical list of sections. An application is not. Do not ask for
"the sections" - derive three lists.

### Routes
The addressable screens. For a gaming forum:
```
/                 index of categories
/c/:category      thread list for one category
/t/:thread        a thread, paginated
/t/:thread/reply  composer (may be inline)
/u/:user          profile: posts, joined, badges
/search           results
/new              create thread
```

### Components
The repeating units. Each is built once and reused. For a forum:
```
CategoryCard   ThreadRow      PostBlock      Composer
UserChip       Pagination     Breadcrumb     Badge
VoteControl    SearchInput    EmptyState     Toast
```

### States
**This is the part that gets skipped and it is where applications actually fail.** Every
list and every form has more than a happy path:

```
loading   empty   one item   many items   too many (paginate)
error     offline   permission denied   deleted/locked
```

`design-taste-frontend` 4.5 requires the full cycle. A thread list with no empty state is
not finished; a new user's first visit *is* the empty state.

---

## 3. Phase 1-B: mockups for an application

**Do not ask for one tall page image.** That is the marketing-track prompt and it produces
a brochure. Ask for **one image per key screen at its most interesting state.**

For a forum, four images beat one: the category index, a thread with replies, the composer
open, and a profile. Generate them with the same Codex `imagegen` flow from
`03-image-generation.md`, one task file per screen, and pass the first as `-i` reference to
the rest so the component family holds (§34 of `image-to-code`).

Prompt shape for an application screen:

```text
Render ONE desktop application screen: <route name> of <product>.

It is a working interface, not a marketing page. Show real interface density:
<N> rows of real content with varied lengths, a persistent left navigation,
a top bar with search and the signed-in user, and visible secondary controls.

Do not render: a hero section, a testimonial, a pricing table, a large centred
headline, or a call-to-action band. This screen is used, not sold.

<palette, type, spacing direction as usual>
```

The negative list matters. Image models default to marketing composition unless told not to.

---

## 4. Phase 5-A: build architecture for an application

**The one-self-contained-HTML-file default does not apply here.** That default exists
because a landing page is static content. An application has state, routing and repeated
components; a single file becomes unmaintainable at the second route.

Reach for a real design system. `design-taste-frontend` 2.A is the authority and it is
explicit that product UI should use an official package rather than hand-rolled CSS:

| The application reads as | Use |
|---|---|
| Community / forum / social | Radix Themes or shadcn/ui, owned components, custom theme |
| Data-dense admin / analytics | Carbon (`@carbon/react`) or Fluent (`@fluentui/react-components`) |
| Developer tool / docs | Primer (`@primer/react-brand` for marketing, `@primer/css` for product) |
| Commerce back office | Polaris, if it is a Shopify surface |
| Public-sector service | `govuk-frontend` or `uswds`, non-negotiable |

**One system per project.** Do not mix.

Data tables are their own problem class - use TanStack Table or AG Grid rather than styling
`<table>` by hand. The taste skill says this outright in its out-of-scope list.

### What still carries over from the marketing track
- the design-system-as-custom-properties discipline
- the accent lock, shape lock, one-theme lock
- the reveal contract: **content must never depend on animation**
- the z-index ladder
- every honesty rule

---

## 5. Verification additions for applications

Run everything in `05-verification-protocol.md` and `07-failure-gates.md`, plus these,
because they have no equivalent on a landing page:

**Every state renders.** For each list and form, force each state and confirm it is
designed, not a blank div:
```js
['loading','empty','one','many','error','denied'].forEach(s => { /* drive it, screenshot/measure */ });
```

**Keyboard reaches every action.** A marketing page needs tab order through a handful of
links. An application must be operable without a mouse end to end.
```js
(() => {
  const f = [...document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
  const noName = f.filter(el => !(el.textContent||'').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'));
  return { focusable: f.length, unlabelled: noName.length,
           positiveTabindex: f.filter(el => +el.getAttribute('tabindex') > 0).length };
})()
```
`unlabelled` and `positiveTabindex` must both be `0`.

**Long content does not break the layout.** Real users post 4000-character replies and
have 40-character usernames. Inject worst-case content and re-run the overflow gate.

**Destructive actions confirm.** Delete, ban, lock and leave must not be one click.

---

## 6. Honesty rules specific to applications

The marketing-track rules still apply, plus:

- **Do not fake a backend and imply it is real.** If the forum has no server, say so in the
  summary and put it in the README. A demo with `localStorage` is fine; presenting it as
  multi-user is not.
- **Do not invent user-generated content that reads as real.** Sample threads and posts are
  fine and necessary; usernames and avatars that look like real people making real claims
  are the same problem as fabricated testimonials.
- **Moderation and reporting flows are not decoration.** If you render a "report" button on
  a community product, either wire it or label it as a non-functional demo.

---

## 7. Worked example: a gaming forum

**Track:** application, with a small marketing surface.

**Discovery adds:** does it need accounts? is content user-generated or seeded? one game or
many? moderation in scope? real backend or a static demo?

**Routes:** index, category, thread, composer, profile, search.
**Components:** CategoryCard, ThreadRow, PostBlock, Composer, UserChip, Pagination, VoteControl, EmptyState.
**States:** every list needs empty (a brand-new category), loading, error, and a paginated
"many". A thread needs locked and deleted-post states.

**Mockups:** four screens, not one tall page.
**Build:** Radix Themes or shadcn/ui with a custom theme; TanStack Table only if a real data
grid appears.
**Imagery:** game key art and avatars via Codex `imagegen`; the same `credits.json`
provenance and third-party-asset rules apply, and game artwork is somebody's copyright.

The failure gates, contrast measurement, responsive sweep, deploy staging and live audit are
identical to every other project in this skill.
