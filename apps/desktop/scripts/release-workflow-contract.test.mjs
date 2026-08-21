import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

const candidate = readFileSync(new URL('../../../.github/workflows/release-vietnamese.yml', import.meta.url), 'utf8')
const promotion = readFileSync(new URL('../../../.github/workflows/promote-vietnamese.yml', import.meta.url), 'utf8')
const pilotPromotion = readFileSync(
  new URL('../../../.github/workflows/promote-pilot-vietnamese.yml', import.meta.url),
  'utf8'
)
const runtimeSmoke = readFileSync(
  new URL('../../../.github/workflows/runtime-smoke-vietnamese.yml', import.meta.url),
  'utf8'
)
const jsTests = readFileSync(new URL('../../../.github/workflows/js-tests.yml', import.meta.url), 'utf8')
const builderWrapper = readFileSync(new URL('../scripts/run-electron-builder.mjs', import.meta.url), 'utf8')

test('candidate workflow builds the complete resident runtime on every advertised native target', () => {
  assert.match(candidate, /scripts\/validate-release-evidence\.test\.mjs/)
  assert.match(candidate, /scripts\/validate-pilot-release-evidence\.test\.mjs/)
  assert.match(candidate, /scripts\/validate-public-release-contract\.test\.mjs/)
  for (const runner of [
    'windows-2025',
    'windows-11-arm',
    'macos-15',
    'macos-15-intel',
    'ubuntu-24.04',
    'ubuntu-24.04-arm'
  ]) {
    assert.match(candidate, new RegExp(runner.replaceAll('.', '\\.')))
  }
  assert.match(candidate, /HERMES_DESKTOP_BUNDLED: '1'/)
  assert.match(candidate, /build-bundled-desktop\.mjs/)
  assert.match(candidate, /dtolnay\/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c/)
  assert.match(candidate, /aarch64-pc-windows-msvc/)
  assert.match(candidate, /Chuẩn bị OpenSSL bất biến cho macOS Intel/)
  assert.match(candidate, /OPENSSL_VERSION: '3\.5\.7'/)
  assert.match(candidate, /a8c0d28a529ca480f9f36cf5792e2cd21984552a3c8e4aa11a24aa31aeac98e8/)
  assert.match(candidate, /OPENSSL_STATIC=1/)
  assert.match(candidate, /Kiểm thử cleanup uninstaller trên runner Windows thật/)
  assert.match(candidate, /if: matrix\.platform == 'win32'/)
  assert.match(candidate, /electron\/desktop-uninstall\.test\.ts/)
  assert.match(candidate, /electron\/active-runtime-state\.test\.ts/)
  assert.match(candidate, /scripts\/browser-connector-extension\.test\.mjs/)
  assert.match(candidate, /electron\/browser-connector\/controller\.test\.ts/)
  assert.match(candidate, /electron\/browser-connector\/cookie-import\.test\.ts/)
  assert.match(candidate, /electron\/browser-connector\/pairing-server\.test\.ts/)
  assert.match(candidate, /electron\/connection-config\.test\.ts/)
  assert.match(candidate, /electron\/connection-registry\.test\.ts/)
  assert.match(candidate, /src\/app\/chat\/right-rail\/browser-connector-dialog\.test\.tsx/)
  assert.match(candidate, /src\/store\/reasoning-summary\.test\.ts/)
  assert.match(candidate, /src\/app\/settings\/model-settings\.test\.tsx/)
  assert.match(candidate, /src\/app\/chat\/session-advisor-bar\.test\.tsx/)
  assert.match(candidate, /src\/app\/chat\/index\.test\.tsx/)
  assert.match(candidate, /src\/app\/gateway\/hooks\/use-gateway-boot\.test\.tsx/)
  assert.match(candidate, /src\/app\/hooks\/use-config-record\.test\.ts/)
  assert.match(candidate, /src\/app\/command-palette\/contrib\.test\.ts/)
  assert.match(candidate, /src\/app\/settings\/plugins-settings\.test\.tsx/)
  assert.match(candidate, /src\/app\/settings\/toolset-config-panel\.test\.tsx/)
  assert.match(candidate, /src\/app\/skills\/index\.test\.tsx/)
  assert.match(candidate, /src\/components\/pane-shell\/tree\/legacy-agent-pane-migration\.test\.ts/)
  assert.match(candidate, /src\/components\/ui\/dropdown-menu\.test\.tsx/)
  assert.match(candidate, /src\/contrib\/plugins-store\.test\.ts/)
  assert.match(candidate, /src\/hermes-profile-scope\.test\.ts/)
  assert.match(candidate, /src\/sdk\/index\.test\.ts/)
  assert.match(candidate, /src\/sdk\/profile-routing\.test\.ts/)
  assert.match(candidate, /src\/store\/gateway-agent-scope\.test\.ts/)
  assert.match(candidate, /src\/store\/hub-actions\.test\.ts/)
  assert.match(candidate, /src\/store\/onboarding\.test\.ts/)
  assert.match(candidate, /src\/store\/profile-agent-activation\.test\.ts/)
  assert.match(candidate, /src\/store\/profile-share\.test\.ts/)
  assert.match(candidate, /src\/store\/session-states-scopes\.test\.ts/)
  const fixedAgentsGate =
    candidate.match(/- name: Kiểm thử bề mặt Agents cố định[\s\S]*?(?=\n      - name:)/)?.[0] ?? ''
  for (const regression of [
    'src/app/chat/session-drag.test.ts',
    'src/app/chat/session-tile-actions.test.ts',
    'src/app/chat/session-tile-attachments.test.tsx',
    'src/app/chat/session-tile-row.test.ts',
    'src/app/contrib/hooks/use-quick-entry-bridge.test.ts',
    'src/app/contrib/hooks/use-session-tile-delegate.test.ts',
    'src/app/session/hooks/use-session-actions.test.tsx',
    'src/store/session-states.test.ts',
    'src/store/session-tile-owner.test.ts'
  ]) {
    assert.ok(fixedAgentsGate.includes(regression), `${regression} must stay in the fixed Agents gate`)
  }
  assert.match(candidate, /src\/app\/shell\/context-usage-panel\.test\.tsx/)
  assert.match(candidate, /src\/app\/chat\/sidebar\/project-dialog\.test\.tsx/)
  assert.match(candidate, /src\/app\/chat\/sidebar\/projects\/project-menu\.test\.tsx/)
  assert.match(candidate, /src\/app\/projects\/index\.test\.tsx/)
  assert.match(candidate, /src\/app\/routes\.workspace-reveal\.test\.ts/)
  assert.match(candidate, /src\/app\/session\/hooks\/use-message-stream\/work-progress-event\.test\.tsx/)
  assert.match(candidate, /src\/app\/usage\/usage-overview\.test\.tsx/)
  assert.match(candidate, /src\/components\/assistant-ui\/thread\/status\.test\.tsx/)
  assert.match(candidate, /src\/store\/layout-right-sidebar\.test\.ts/)
  assert.match(candidate, /src\/store\/layout-pinned-order\.test\.ts/)
  assert.match(candidate, /src\/store\/layout-connection-scope\.test\.ts/)
  assert.match(candidate, /src\/store\/projects\.test\.ts/)
  assert.match(candidate, /src\/lib\/format\.test\.ts/)
  assert.match(candidate, /src\/i18n\/context\.test\.tsx/)
  assert.match(candidate, /src\/i18n\/languages\.test\.ts/)
  assert.match(candidate, /src\/i18n\/plugin-i18n\.test\.tsx/)
  assert.match(candidate, /tests\/agent\/test_oneshot\.py/)
  assert.match(candidate, /tests\/agent\/test_advisor\.py/)
  assert.match(candidate, /tests\/agent\/test_usage_pricing\.py/)
  assert.match(candidate, /tests\/run_agent\/test_advisor_checkpoints\.py/)
  assert.match(candidate, /tests\/tui_gateway\/test_advisor_session_scope\.py/)
  assert.match(candidate, /tests\/tui_gateway\/test_profiles_create_credentials\.py/)
  assert.match(candidate, /tests\/tui_gateway\/test_protocol\.py/)
  assert.match(candidate, /tests\/test_public_release_downloads\.py/)
  assert.match(candidate, /tests\/test_tui_gateway_server\.py/)
  assert.match(candidate, /npm run --prefix apps\/desktop check:test:plugins/)
  assert.match(candidate, /npm run --prefix apps\/desktop lint/)
  for (const requiredPreDraftGate of [
    'npm run --prefix apps/desktop lint',
    'src/hermes-profile-scope.test.ts',
    'src/app/hooks/use-config-record.test.ts',
    'src/app/skills/index.test.tsx',
    'src/app/settings/toolset-config-panel.test.tsx',
    'src/store/hub-actions.test.ts',
    'src/store/gateway-agent-scope.test.ts',
    'src/store/backend-owner.test.ts',
    'src/store/mcp-deeplink-install.test.ts',
    'src/store/onboarding.test.ts',
    'src/store/starmap.test.ts',
    'src/store/voice-prefs.test.ts',
    'src/sdk/profile-routing.test.ts'
  ]) {
    assert.ok(
      candidate.indexOf(requiredPreDraftGate) < candidate.indexOf('gh release create "$TAG"'),
      `${requiredPreDraftGate} must pass before draft creation`
    )
  }
  assert.match(candidate, /signpath\/github-action-submit-signing-request@c92b958760219087e01f8d67a1669ed57afe2627/)
  assert.match(candidate, /Get-AuthenticodeSignature/)
  assert.match(candidate, /SIGNPATH_SIGNING_POLICY_SLUG/)
  assert.match(candidate, /SIGNPATH_ARTIFACT_CONFIGURATION_SLUG/)
  assert.match(candidate, /skip-decompress: true/)
  assert.match(candidate, /Bắt buộc cấu hình ký và công chứng Apple/)
  assert.match(candidate, /CSC_IDENTITY_AUTO_DISCOVERY/)
  assert.match(candidate, /unset CSC_LINK CSC_KEY_PASSWORD APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER/)
  assert.match(candidate, /community-prerelease/)
  assert.match(candidate, /release_class/)
  assert.ok(
    candidate.indexOf('Thay bằng đúng byte đã ký') < candidate.indexOf('Ghi lại checksum sau ký'),
    'Windows checksum must be regenerated after replacing the unsigned installer'
  )
  assert.match(candidate, /test:desktop:all/)
  assert.match(candidate, /uv sync --locked --python 3\.11 --extra dev/)
  assert.match(candidate, /\.\/scripts\/run_tests\.sh -q/)
  assert.doesNotMatch(candidate, /uv run pytest/)
  assert.match(candidate, /Upload đúng byte vào draft/)
  assert.match(candidate, /generate-community-update-metadata\.mjs/)
  assert.ok(
    candidate.indexOf('generate-community-update-metadata.mjs') <
      candidate.indexOf('collect-community-artifacts.mjs checksums release-assets SHA256SUMS.txt'),
    'update metadata must be generated before the combined SHA-256 manifest'
  )
  assert.match(candidate, /\(cd release-assets && sha256sum candidate-provenance\.json >> SHA256SUMS\.txt\)/)
  assert.doesNotMatch(candidate, /sha256sum release-assets\/candidate-provenance\.json/)
})

test('candidate workflow can only create a draft and never promotes it', () => {
  assert.match(candidate, /gh release create "\$TAG" --verify-tag --target "\$COMMIT" --draft/)
  assert.match(candidate, /release_title: \$\{\{ steps\.candidate\.outputs\.release_title \}\}/)
  assert.match(candidate, /resolveVietnameseReleaseCandidate/)
  assert.match(candidate, /--title "\$RELEASE_TITLE"/)
  assert.doesNotMatch(candidate, /--title "\$TAG"/)
  assert.doesNotMatch(candidate, /--draft=false/)
  assert.match(candidate, /--draft --prerelease/)
  assert.match(builderWrapper, /args\.push\("--publish", "never"\)/)
})

test('promotion is separate and requires exact manifest plus successful runtime smoke evidence', () => {
  assert.match(promotion, /environment: release-production/)
  assert.match(promotion, /^\s*group: hermes-vietnamese-promotion$/m)
  assert.doesNotMatch(promotion, /group: hermes-vietnamese-promotion-\$\{\{ inputs\.tag \}\}/)
  assert.match(promotion, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/)
  assert.match(promotion, /ref: \$\{\{ inputs\.tag \}\}/)
  assert.match(promotion, /test "\$\(git rev-parse HEAD\)" = "\$candidate_commit"/)
  assert.match(promotion, /sha256sums_sha256/)
  assert.match(promotion, /runtime_smoke_run_id/)
  assert.match(promotion, /release-evidence\.json/)
  assert.match(promotion, /node scripts\/validate-release-evidence\.mjs/)
  assert.match(promotion, /e\.commit!==process\.env\.CANDIDATE_COMMIT/)
  assert.match(promotion, /\.conclusion.*success/)
  assert.match(promotion, /gh release edit "\$TAG" --repo "\$GITHUB_REPOSITORY" --draft=false --prerelease=true/)
  assert.match(promotion, /gh release edit "\$TAG" --repo "\$GITHUB_REPOSITORY" --draft=false --prerelease=false/)
  assert.match(promotion, /releaseClass!==process\.env\.RELEASE_CLASS/)
  assert.match(promotion, /public-release\.json'\)\.tag/)
  assert.match(promotion, /public-release\.json'\)\.releaseClass/)
  assert.match(promotion, /validate-public-release-contract\.mjs candidate "\$TAG" "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /release-asset-inventory\.mjs candidate release-runtime-evidence\.json/)
  assert.match(promotion, /release-asset-inventory\.mjs public release-runtime-evidence\.json/)
  assert.match(promotion, /candidate\/release-runtime-evidence\.json/)
  assert.match(promotion, /assert\.deepStrictEqual\(candidate, validated/)
  assert.match(promotion, /cmp candidate\/release-runtime-evidence\.json public\/release-runtime-evidence\.json/)
  assert.match(promotion, /tests\/test_public_release_downloads\.py/)
  assert.match(promotion, /browser_download_url/)
  assert.match(promotion, /draft asset inventory mismatch/)
  assert.match(promotion, /rollback_publication/)
  assert.match(promotion, /--draft=true --prerelease="\$expected_prerelease" --latest=false/)
  assert.match(promotion, /--draft=false --prerelease=true --latest=false/)
  assert.match(promotion, /--draft=false --prerelease=false --latest/)
  assert.match(promotion, /releases\/latest/)
  assert.match(promotion, /test "\$latest_tag" != "\$TAG"/)
  assert.equal((promotion.match(/^\s*validateStablePromotionOrder\(\{/gm) ?? []).length, 1)
  assert.match(promotion, /PREVIOUS_LATEST="\$previous_latest"/)
  assert.match(promotion, /previousLatestTag: process\.env\.PREVIOUS_LATEST/)
  assert.ok(
    promotion.indexOf('validateStablePromotionOrder({') <
      promotion.indexOf('rollback_publication'),
    'stable promotion must prove monotonic Latest order before mutation'
  )
  assert.equal(
    (promotion.match(/^\s*validateVietnameseReleasePresentation\(\{/gm) ?? []).length,
    2,
    'general promotion must exact-check the release presentation before and after mutation'
  )
  assert.equal((promotion.match(/const candidate = resolveVietnameseReleaseCandidate/g) ?? []).length, 2)
  assert.match(promotion, /expectedBody: fs\.readFileSync\('\.github\/release-notes-vietnamese\.md', 'utf8'\)/)
  assert.match(promotion, /--json isDraft,isPrerelease,name,body > candidate-release\.json/)
  assert.match(promotion, /--json isDraft,isPrerelease,name,body > published-release\.json/)
  assert.equal((promotion.match(/^\s*validateFeaturedCandidatePromotion\(\{/gm) ?? []).length, 1)
  assert.equal((promotion.match(/^\s*validateVietnameseReleaseNotesForClass\(\{/gm) ?? []).length, 1)
  assert.match(promotion, /process\.env\.RELEASE_CLASS === 'community-prerelease'/)
  assert.match(promotion, /releaseClass: process\.env\.RELEASE_CLASS/)
  assert.match(promotion, /featuredCandidate: publicRelease\.featuredCandidate/)
  assert.match(promotion, /tag: process\.env\.TAG/)
  assert.ok(
    promotion.indexOf('validateFeaturedCandidatePromotion({') <
      promotion.indexOf('rollback_publication'),
    'general prerelease promotion must bind its exact public callout before mutation'
  )
  assert.ok(
    promotion.indexOf('validateVietnameseReleasePresentation') <
      promotion.indexOf('rollback_publication'),
    'general promotion must reject a stale title/body before any publication mutation is prepared'
  )
  assert.ok(
    promotion.lastIndexOf('validateVietnameseReleasePresentation') >
      promotion.lastIndexOf('gh release edit "$TAG"'),
    'general promotion must recheck the title/body after publication'
  )
  assert.ok(
    promotion.indexOf('validate-public-release-contract.mjs') <
      promotion.indexOf('Công khai, hậu kiểm và tự quay về draft nếu hậu kiểm lỗi'),
    'the exact public download contract must pass before release publication'
  )
})

test('runtime smoke refuses missing platform, update, persistence, signing, or real-machine evidence', () => {
  assert.match(runtimeSmoke, /name: Kiểm thử runtime artifact Hermes Vietnamese/)
  assert.match(runtimeSmoke, /windows-11-arm/)
  assert.match(runtimeSmoke, /macos-15-intel/)
  assert.match(runtimeSmoke, /validate-release-evidence\.mjs/)
  assert.match(runtimeSmoke, /release-runtime-evidence\.json/)
  assert.match(runtimeSmoke, /community-prerelease/)
  assert.match(runtimeSmoke, /release_class/)
  assert.match(runtimeSmoke, /candidate_commit="\$\(git rev-parse HEAD\)"/)
  assert.match(runtimeSmoke, /gh release download "\$TAG" --repo "\$GITHUB_REPOSITORY" --pattern "\$ARTIFACT"/)
})

test('pilot promotion stays prerelease, validates every byte, and discloses missing native smoke', () => {
  assert.match(pilotPromotion, /environment: release-production/)
  assert.match(pilotPromotion, /^\s*group: hermes-vietnamese-promotion$/m)
  assert.doesNotMatch(pilotPromotion, /group: hermes-vietnamese-pilot-promotion-/)
  assert.match(pilotPromotion, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/)
  assert.match(pilotPromotion, /ref: \$\{\{ inputs\.tag \}\}/)
  assert.match(pilotPromotion, /test "\$\(git rev-parse HEAD\)" = "\$candidate_commit"/)
  assert.match(pilotPromotion, /validate-pilot-release-evidence\.mjs/)
  assert.match(pilotPromotion, /Dựng và staging Hermes Vietnamese/)
  assert.match(pilotPromotion, /sha256sum --check SHA256SUMS\.txt/)
  assert.match(pilotPromotion, /browser_download_url/)
  assert.match(pilotPromotion, /draft asset inventory mismatch/)
  assert.match(pilotPromotion, /rollback_publication/)
  assert.match(pilotPromotion, /--draft=true --prerelease=true --latest=false/)
  assert.match(pilotPromotion, /--draft=false --prerelease=true --latest=false/)
  assert.match(pilotPromotion, /releases\/latest/)
  assert.match(pilotPromotion, /releases\/download\/\$TAG\/SHA256SUMS\.txt/)
  assert.match(pilotPromotion, /head_sha/)
  assert.match(pilotPromotion, /tests\/test_public_release_downloads\.py/)
  assert.match(pilotPromotion, /URLs may still 404 while the release/)
  assert.match(pilotPromotion, /stale\/false README metadata/)
  assert.equal(
    (pilotPromotion.match(/^\s*validateVietnameseReleasePresentation\(\{/gm) ?? []).length,
    2,
    'pilot promotion must exact-check the release presentation before and after mutation'
  )
  assert.equal((pilotPromotion.match(/const candidate = resolveVietnameseReleaseCandidate/g) ?? []).length, 2)
  assert.match(pilotPromotion, /expectedBody: fs\.readFileSync\('\.github\/release-notes-vietnamese\.md', 'utf8'\)/)
  assert.match(pilotPromotion, /--json isDraft,isPrerelease,name,body > candidate-release\.json/)
  assert.match(pilotPromotion, /--json isDraft,isPrerelease,url,name,body > published-release\.json/)
  assert.equal((pilotPromotion.match(/^\s*validateFeaturedCandidatePromotion\(\{/gm) ?? []).length, 1)
  assert.equal((pilotPromotion.match(/^\s*validateVietnameseReleaseNotesForClass\(\{/gm) ?? []).length, 1)
  assert.match(pilotPromotion, /releaseClass: 'community-prerelease'/)
  assert.match(pilotPromotion, /featuredCandidate: publicRelease\.featuredCandidate/)
  assert.match(pilotPromotion, /tag: process\.env\.TAG/)
  assert.match(pilotPromotion, /committed_latest="\$\(node -p "require\('\.\/\.github\/public-release\.json'\)\.tag"\)"/)
  assert.match(pilotPromotion, /test "\$previous_latest" = "\$committed_latest"/)
  assert.match(pilotPromotion, /test "\$TAG" != "\$previous_latest"/)
  assert.ok(
    pilotPromotion.indexOf('validateFeaturedCandidatePromotion({') <
      pilotPromotion.indexOf('rollback_publication'),
    'pilot promotion must bind its exact public callout before mutation'
  )
  assert.ok(
    pilotPromotion.indexOf('tests/test_public_release_downloads.py') <
      pilotPromotion.indexOf('rollback_publication'),
    'pilot promotion must validate prepared public callouts before publication'
  )
  assert.ok(
    pilotPromotion.lastIndexOf('validateVietnameseReleasePresentation') >
      pilotPromotion.lastIndexOf('gh release edit "$TAG"'),
    'pilot promotion must recheck the title/body after publication'
  )
  assert.ok(
    pilotPromotion.indexOf('test "$previous_latest" = "$committed_latest"') <
      pilotPromotion.lastIndexOf('gh release edit "$TAG"'),
    'pilot promotion must bind live Latest to the committed default before publication'
  )
  assert.doesNotMatch(pilotPromotion, /--prerelease=false/)
})

test('release verification commands identify the repository outside a checkout', () => {
  assert.match(promotion, /gh release view "\$TAG" --repo "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /gh release download "\$TAG" --repo "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /gh run download "\$SMOKE_RUN_ID" --repo "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /gh release edit "\$TAG" --repo "\$GITHUB_REPOSITORY"/)
})

test('the ordinary packaged desktop gate installs uv before invoking the build', () => {
  assert.match(jsTests, /matrix\.script == 'check:test:desktop:all'/)
  assert.match(jsTests, /astral-sh\/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39/)
})
