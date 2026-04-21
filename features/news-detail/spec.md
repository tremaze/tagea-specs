# Feature: News Detail (Cross-Cutting)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

A single component that renders a news article for two contexts — teamspace and client-portal — with context-specific behavior for comments, attachments, like/acknowledge actions, and navigation wrapping. Shared article shell provides layout; context switches comment service and permission rules.

## Modes

**The same component is mounted twice** via `data.context`:

| Context         | Route                     | Comments source                           |
| --------------- | ------------------------- | ----------------------------------------- |
| `teamspace`     | `/teamspace/news/:id`     | `CommentsService` (staff comments)        |
| `client-portal` | `/client-portal/news/:id` | `ClientCommentsService` (client comments) |

The component reads `route.data.context: NewsDetailContext` and dispatches to the right comment service.

## User Stories

- As a **reader** I want to read the full article with images and attachments, so that I get the complete message.
- As a **reader** I want to like the article, so that authors see engagement.
- As a **reader** I want to see and post comments (if permitted), so that I can discuss the content.
- As a **reader of an acknowledgment-required article** I want a clear "I've read this" action, so that I can complete my duty.

## Acceptance Criteria

### Load + Display

- [ ] **Given** the detail route loads, **When** the article fetches, **Then** title, body, author, publish date, cover image (secure), and attachments render via `ArticleDetailShellComponent`.
- [ ] **Given** the article requires acknowledgment (`requiresAcknowledgment() === true`), **When** the header renders, **Then** an "Acknowledge" button is shown near the title.
- [ ] **Given** the article has attachments, **When** they render, **Then** `ArticleAttachmentsDisplayComponent` handles download/preview per file.

### Comments

- [ ] **Given** the context is `teamspace`, **When** comments load, **Then** `CommentsService` is used; staff can see and post.
- [ ] **Given** the context is `client-portal`, **When** comments load, **Then** `ClientCommentsService` is used; clients can see and post (subject to tenant config).
- [ ] **Given** the viewport is desktop, **When** the layout renders, **Then** comments appear in a sidebar.
- [ ] **Given** the viewport is mobile, **When** the layout renders, **Then** comments are hidden inline and accessible via a FAB that opens a bottom sheet.
- [ ] **Given** a comment is posted, **When** the server accepts it, **Then** the list updates immediately (optimistic or server-confirmed).
- [ ] **Given** a comment is deleted (by author or admin), **When** confirmation is given, **Then** it disappears from the list (`SimpleConfirmationDialogComponent`).

### Like / Acknowledge

- [ ] **Given** the "Like" action fires, **When** the service returns, **Then** the like count + is-liked state update (same pattern as dashboard card).
- [ ] **Given** the user acknowledges, **When** the acknowledge endpoint succeeds, **Then** the button changes to a confirmation state and the record is persisted.

### Read Status

- [ ] **Given** the detail loads in teamspace, **When** the article is unread, **Then** it is marked as read via `ContentReadStatusService.markAsRead('article', articleId)`.
- [ ] **Given** the detail loads in client-portal, **When** the article is unread, **Then** it is marked as seen via `ClientNewsService.markAsSeen(articleId)`.

## UI States

| State        | When?                | What the user sees              | A11y notes                      |
| ------------ | -------------------- | ------------------------------- | ------------------------------- |
| Loading      | Initial fetch        | Skeleton / spinner              | `role="status"`                 |
| Error        | Fetch fail           | Error block + retry             | `role="alert"`                  |
| Loaded       | Fetch ok             | Full article + comments section | —                               |
| Acknowledged | After acknowledgment | Button state swap               | `aria-pressed="true"` on button |

## Non-Goals

- **Editing articles** — only reading is covered here; editing lives under "Redaktion".
- **Sharing externally** — not implemented.

## Edge Cases

- **Translations:** `display_title` / translated content has precedence.
- **Secure cover image / inline images:** fetched with auth via `SecureImageService` (or equivalent).
- **Deleted article:** route should gracefully 404 with a back-link.
- **Comments disabled by tenant:** sidebar hides; FAB on mobile hides.
- **Mobile keyboard overlap:** bottom-sheet comment composer must respect soft keyboard (verify on Angular mobile web + Flutter).

## Permissions & Tenant/Institution

- **Teamspace context:** `teamspace_news.view` + `teamspaceFeatureGuard`.
- **Client-portal context:** `clientPortalGuard`.
- **Comment permissions:** context-specific. Client comments may be moderated; staff comments are direct.
- **Acknowledgment:** tenant-configured per article.

## Notifications (Push / In-App)

- Push notification for a new article deep-links here (teamspace or client-portal route, depending on audience).
- New comment notifications (if enabled) also deep-link here.
- Auto-mark-as-read fires on load.

## i18n Keys

> User-facing strings remain in German.

Owned by `ArticleDetailShellComponent` + comment form template. Full inventory to be compiled during port.

## Offline Behavior

**Flutter-specific:**

- Cached article offline (if previously read).
- Comments: show cached, disable posting offline (or queue + flush).
- Like / acknowledge require online.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts`](../../../apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts)
- **Shell:** [`ArticleDetailShellComponent`](../../../apps/tagea-frontend/src/app/shared/articles/article-detail-shell/article-detail-shell.component.ts)
- **Attachments display:** [`ArticleAttachmentsDisplayComponent`](../../../apps/tagea-frontend/src/app/shared/articles/article-attachments-display/article-attachments-display.component.ts)
- **Services:**
  - `ArticleService` — `getArticle`, `toggleLike`, `toggleAcknowledgment`, `getAttachments` (teamspace)
  - `ClientNewsService` — `getNewsArticle`, `likeArticle`, `acknowledgeArticle`, `markAsSeen` (client portal)
  - `CommentsService` / `ClientCommentsService` — `getCommentsByArticle`, `createComment`, `updateComment`, `deleteComment`, `likeComment`, `unlikeComment`
  - `ContentReadStatusService` — `markAsRead('article', id)` (teamspace)
  - `SecureImageService` (indirectly, for images)
- **Type:** `NewsDetailContext = 'teamspace' | 'client-portal'`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
