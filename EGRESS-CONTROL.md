# Egress control and release requirement

Mob's North project is xrvqyraafmwpfenysmfo in organization wefmdvynbxbwcsqacqzt.

## Published Free allowance, checked 2026-11-18

Supabase currently includes **5 GB uncached egress and a separate 5 GB cached egress per billing cycle** on Free. These pools are independent; cached allowance cannot cover database or Auth traffic. Quotas apply across the organization. North's Free plan was verified through the Mob connection. Actual consumption and remaining allowance remain unmeasured. [Pricing](https://supabase.com/pricing), [egress accounting and quotas](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

Free has no usage charges, but exceeding quota can trigger a grace period and restrictions. Spend Cap is a Pro-only feature, and its documented behavior does not establish an exact pre-response byte ceiling. Knowing the 5 GB allowance does not provide an enforceable shared meter. [Cost controls](https://supabase.com/docs/guides/platform/cost-control).

Android no longer uploads usage or polls profiles/focus history. Its task data and explicitly opted-in aggregate Social focus score sync. Social uses one bounded RPC on a five-minute foreground cadence; unchanged cumulative scores do not rewrite rows. Android does not upload individual focus-session histories.

## What is implemented

Flow uploads contain at most 80 changed hourly counters per request, with cumulative values and idempotent server reconciliation. Background uploads run at a 5-minute cadence. Retries preserve the local queue. Foreground sampling never makes a cloud request.

The shared dashboard uses compact aggregate arrays and a per-device baseline to merge unsynced counters without double-counting. Profile polling excludes background photos and downloads a photo only when its hash changes. Settings writes are coalesced into a durable field-level queue. No Realtime subscription, Supabase-hosted video, or Supabase Storage asset download is used by Mob.

## All relevant traffic

| Service | Mob traffic | Required quota coverage |
| --- | --- | --- |
| Database API | Usage counters, dashboard snapshots, settings, tasks, focus sessions and leaderboard | Every response, including failures and requests from old clients |
| Auth | Google OAuth, password sign-in, token refresh, sign-out and account updates | Auth responses and refresh traffic |
| Edge Functions | Username-login proxy | Function responses and outbound data |
| Storage and CDN | Mob currently serves media with the web bundle | Any existing project buckets, public URLs or other consumers still count |
| Realtime | Mob has no subscriptions | Any other project consumers remain relevant |
| Poolers and database connections | Administrative queries, backups and other clients | Their response traffic |
| Log drains | Any configured project drains | Outbound log traffic |
| Other projects | The organization can share quota across projects | Organization-wide usage and cached/uncached pools |

Supabase documents unified egress across Database, Auth, Storage, Edge Functions, Realtime and Log Drains. Cached and uncached quotas are independent. [Egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Why a strict ceiling is still blocked

Client timers and a SQL response counter cannot intercept Auth, public Storage/CDN responses, pooler traffic, other consumers or old clients. A SQL response counter also cannot accurately include all HTTP headers and transport overhead. They cannot guarantee the organization remains below quota.

Supabase documents Spend Cap as restricting further usage after the quota has been exceeded. Its egress documentation also describes a grace period. That is a cost/restriction mechanism, and does not establish a pre-response byte ceiling. [Cost control](https://supabase.com/docs/guides/platform/cost-control), [egress restrictions](https://supabase.com/docs/guides/platform/manage-your-usage/egress)

## Exact remaining actions

1. Access is confirmed through Mob for North, and its plan is Free. Always select Mob explicitly. Remaining quota, billing-cycle dates and service-wide traffic still need measurement; the available tools do not report organization egress totals.
2. In the owning organization's Billing → Cost Control, verify Spend Cap is enabled if the plan supports it. Confirm the separate cached and uncached allowances and any usage shared by other projects.
3. Ask Supabase support to confirm whether a provider-enforced, pre-response hard byte limit is available for every relevant egress service and the shared organization quota. Require confirmation of accounting delay, in-flight request behavior, CDN coverage and grace periods. Enable that control before claiming a strict ceiling.
4. If Supabase cannot provide that capability, the strict requirement needs an exclusive, externally metered gateway for every application endpoint plus removal of direct/legacy access, and provider controls for database connections, public storage/CDN, drains and other project traffic. A usage-only gateway is insufficient. Implementing and proving this requires the owning account's infrastructure controls and service inventory.
5. Until the strict mechanism is configured and verified, retain the deployment gate. Mob's reduced bandwidth is implemented, but project-wide quota compliance is unverified.
