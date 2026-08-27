import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { test } from 'vitest'

const candidate = readFileSync(new URL('../../../.github/workflows/release-vietnamese.yml', import.meta.url), 'utf8')
const promotion = readFileSync(new URL('../../../.github/workflows/promote-vietnamese.yml', import.meta.url), 'utf8')
const pilotPromotion = readFileSync(
  new URL('../../../.github/workflows/promote-pilot-vietnamese.yml', import.meta.url),
  'utf8'
)
const v32Promotion = readFileSync(
  new URL('../../../.github/workflows/promote-v32-vietnamese.yml', import.meta.url),
  'utf8'
)
const v321Promotion = readFileSync(
  new URL('../../../.github/workflows/promote-v321-vietnamese.yml', import.meta.url),
  'utf8'
)
const runtimeSmoke = readFileSync(
  new URL('../../../.github/workflows/runtime-smoke-vietnamese.yml', import.meta.url),
  'utf8'
)
const lifecycleRunner = readFileSync(
  new URL('../../../scripts/windows-lifecycle-acceptance/run.mjs', import.meta.url),
  'utf8'
)
const v32PromotionValidator = readFileSync(
  new URL('../../../scripts/validate-v32-promotion.mjs', import.meta.url),
  'utf8'
)
const jsTests = readFileSync(new URL('../../../.github/workflows/js-tests.yml', import.meta.url), 'utf8')
const vitestConfig = readFileSync(new URL('../vitest.config.ts', import.meta.url), 'utf8')
const builderWrapper = readFileSync(new URL('../scripts/run-electron-builder.mjs', import.meta.url), 'utf8')
const bundledBuild = readFileSync(new URL('../../../scripts/build-bundled-desktop.mjs', import.meta.url), 'utf8')
const v32PackagedSmoke = readFileSync(new URL('../e2e/v32-packaged-smoke.spec.ts', import.meta.url), 'utf8')

test('node:test builder patch regressions stay out of the Vitest project', () => {
  for (const nodeTestSuite of [
    'scripts/patch-electron-builder-mac-binary.test.mjs',
    'scripts/patch-electron-builder-windows-nsis.test.mjs'
  ]) {
    assert.match(vitestConfig, new RegExp(nodeTestSuite.replaceAll('.', '\\.')))
  }
})

test('v32 packaged relaunch owns bounded evidence instead of worker-level multi-app tracing', () => {
  assert.match(v32PackagedSmoke, /test\.use\(\{ screenshot: 'off', trace: 'off' \}\)/)
  assert.match(v32PackagedSmoke, /testInfo\.outputPath\('packaged-v32-ux\.png'\)/)
  assert.match(v32PackagedSmoke, /testInfo\.outputPath\('packaged-v32-compaction\.png'\)/)
  assert.equal((v32PackagedSmoke.match(/await fixture\.page\.screenshot/g) ?? []).length, 2)
})

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
  assert.match(candidate, /src\/app\/chat\/session-gateway-control\.test\.tsx/)
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
  assert.match(candidate, /src\/store\/system-actions\.test\.ts/)
  const fixedAgentsGate = candidate.match(/- name: Kiểm thử bề mặt Agents cố định[\s\S]*?(?=\n {6}- name:)/)?.[0] ?? ''
  for (const regression of [
    'src/app/chat/session-advisor-bar.test.tsx',
    'src/app/chat/session-gateway-control.test.tsx',
    'src/app/chat/session-drag.test.ts',
    'src/app/chat/session-tile-actions.test.ts',
    'src/app/chat/session-tile-attachments.test.tsx',
    'src/app/chat/session-tile-row.test.ts',
    'src/app/contrib/hooks/use-quick-entry-bridge.test.ts',
    'src/app/contrib/hooks/use-session-tile-delegate.test.ts',
    'src/app/session/hooks/use-session-actions.test.tsx',
    'src/hermes-profile-scope.test.ts',
    'src/store/session-states.test.ts',
    'src/store/session-tile-owner.test.ts',
    'src/store/system-actions.test.ts'
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
  assert.match(candidate, /tests\/hermes_cli\/test_web_server_profile_unification\.py/)
  assert.match(candidate, /tests\/test_public_release_downloads\.py/)
  assert.match(candidate, /tests\/test_tui_gateway_server\.py/)
  assert.match(candidate, /npm run --prefix apps\/desktop check:test:plugins/)
  assert.match(candidate, /npm run --prefix apps\/desktop lint/)
  for (const requiredPreDraftGate of [
    'npm run --prefix apps/desktop lint',
    'scripts/browser-connector-extension.test.mjs',
    'electron/browser-connector/cookie-import.test.ts',
    'electron/browser-connector/pairing-server.test.ts',
    'src/hermes-profile-scope.test.ts',
    'src/app/chat/session-gateway-control.test.tsx',
    'src/app/hooks/use-config-record.test.ts',
    'src/app/skills/index.test.tsx',
    'src/app/settings/toolset-config-panel.test.tsx',
    'src/store/hub-actions.test.ts',
    'src/store/gateway-agent-scope.test.ts',
    'src/store/backend-owner.test.ts',
    'src/store/mcp-deeplink-install.test.ts',
    'src/store/onboarding.test.ts',
    'src/store/starmap.test.ts',
    'src/store/system-actions.test.ts',
    'src/store/voice-prefs.test.ts',
    'src/sdk/profile-routing.test.ts',
    'tests/hermes_cli/test_web_server_profile_unification.py'
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
  assert.match(candidate, /HERMES_PAYLOAD_GIT_REF: \$\{\{ needs\.verify\.outputs\.commit \}\}/)
  assert.match(candidate, /HERMES_DESKTOP_EXPECTED_ARTIFACT=release\/%s/)
  assert.ok(
    candidate.indexOf('Khóa đúng đường dẫn artifact vừa dựng') < candidate.indexOf('Kiểm tra đúng payload đóng gói'),
    'exact distribution artifact path must be bound before packaged validation'
  )
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
  const exactTagBindingIndex = candidate.indexOf('test "$tag_commit" = "$head_commit"')
  const draftCreationIndex = candidate.indexOf('gh release create "$TAG"')

  assert.notEqual(exactTagBindingIndex, -1)
  assert.notEqual(draftCreationIndex, -1)
  assert.ok(exactTagBindingIndex < draftCreationIndex, 'exact tag binding must pass before draft creation')
  assert.match(candidate, /ref: \$\{\{ needs\.verify\.outputs\.tag \}\}/)
  assert.match(candidate, /gh release create "\$TAG" --verify-tag --draft/)
  assert.doesNotMatch(candidate, /gh release create "\$TAG"[^\r\n]*--target/)
  assert.match(candidate, /release_title: \$\{\{ steps\.candidate\.outputs\.release_title \}\}/)
  assert.match(candidate, /resolveVietnameseReleaseCandidate/)
  assert.match(candidate, /--title "\$RELEASE_TITLE"/)
  assert.doesNotMatch(candidate, /--title "\$TAG"/)
  assert.doesNotMatch(candidate, /--draft=false/)
  assert.match(candidate, /--draft --prerelease/)
  assert.match(builderWrapper, /args\.push\("--publish", "never"\)/)
})

test('candidate verify refreshes the immutable tag with bounded retry before binding it', () => {
  const verify = candidate.slice(candidate.indexOf('\n  verify:\n'), candidate.indexOf('\n  build:\n'))
  const retryIndex = verify.indexOf('- name: Tải lại tag ứng viên với retry giới hạn')
  const guardIndex = verify.indexOf('- name: Khóa nhãn và commit ứng viên')
  const retry = verify.slice(retryIndex, guardIndex)
  const guard = verify.slice(guardIndex)

  assert.notEqual(retryIndex, -1)
  assert.notEqual(guardIndex, -1)
  assert.ok(retryIndex < guardIndex)
  assert.match(retry, /uses: \.\/\.github\/actions\/retry/)
  assert.match(retry, /command: git fetch --force origin "refs\/tags\/\$RELEASE_TAG:refs\/tags\/\$RELEASE_TAG"/)
  assert.match(retry, /attempts: '5'/)
  assert.match(retry, /delay: '15'/)
  assert.doesNotMatch(guard, /git fetch/)
})

test('candidate workflow fails closed on unsigned feeds and the Windows ARM64 native limitation', () => {
  assert.match(bundledBuild, /validateBundledBuildNode\(process\.versions\.node\)/)
  assert.match(bundledBuild, /validateBundledBuildNode\(pathNodeProbe\.stdout\)/)
  for (const regression of [
    'scripts/bundled-release-policy.test.mjs',
    'scripts/patch-electron-builder-mac-binary.test.mjs',
    'scripts/patch-electron-builder-windows-nsis.test.mjs',
    'scripts/stage-native-deps.test.mjs',
    'tests/test_release_node_floor_contract.py',
    'tests/test_install_sh_venv_transaction.py'
  ]) {
    assert.ok(candidate.includes(regression), `${regression} must run before the candidate build`)
  }

  const stableMetadata =
    candidate.match(/- name: Lập metadata cập nhật theo đúng artifact đã dựng[\s\S]*?(?=\n {6}- name:)/)?.[0] ?? ''
  assert.match(stableMetadata, /if: needs\.verify\.outputs\.release_class == 'stable'/)
  assert.match(stableMetadata, /generate-community-update-metadata\.mjs[\s\S]*\)" stable/)

  const communityFeedGate =
    candidate.match(/- name: Chặn feed cập nhật cho community prerelease chưa ký[\s\S]*?(?=\n {6}- name:)/)?.[0] ?? ''
  assert.match(communityFeedGate, /if: needs\.verify\.outputs\.release_class == 'community-prerelease'/)
  assert.match(communityFeedGate, /feeds=\(release-assets\/latest\*\.yml\)/)
  assert.match(communityFeedGate, /community-prerelease must not publish stable update metadata/)
  assert.ok(
    candidate.indexOf('Chặn feed cập nhật cho community prerelease chưa ký') <
      candidate.lastIndexOf('collect-community-artifacts.mjs checksums release-assets SHA256SUMS.txt'),
    'community feed absence must be checked before the combined manifest is written'
  )

  assert.match(
    candidate,
    /HERMES_ALLOW_WIN32_ARM64_GET_WINDOWS_LIMITATION: \$\{\{ matrix\.id == 'windows-arm64' && needs\.verify\.outputs\.release_class == 'community-prerelease' && '1' \|\| '0' \}\}/
  )
  assert.match(candidate, /Ghi giới hạn build-only Windows ARM64/)
  assert.match(candidate, /support_scope=build-only-pilot/)
  assert.match(candidate, /read_window_below=unavailable/)
  assert.match(candidate, /stable_eligible=false/)
  assert.ok(
    candidate.indexOf('Ghi giới hạn build-only Windows ARM64') < candidate.indexOf('Ghi lại checksum sau ký'),
    'the Windows ARM64 limitation must be covered by release checksums'
  )
})

test('candidate stage rebinds the fresh tag and checkout to the verified commit before creation', () => {
  const stage = candidate.slice(candidate.indexOf('\n  stage:\n'))
  const checkoutIndex = stage.indexOf('ref: ${{ needs.verify.outputs.tag }}')
  const retryIndex = stage.indexOf('- name: Tải lại tag staging với retry giới hạn')
  const guardIndex = stage.indexOf('- name: Khóa lại tag và commit trước staging')
  const metadataIndex = stage.indexOf('- name: Lập metadata cập nhật theo đúng artifact đã dựng')
  const draftCreationIndex = stage.indexOf('gh release create "$TAG"')
  const guard = stage.slice(guardIndex, metadataIndex)

  assert.notEqual(checkoutIndex, -1)
  assert.notEqual(retryIndex, -1)
  assert.notEqual(guardIndex, -1)
  assert.notEqual(metadataIndex, -1)
  assert.notEqual(draftCreationIndex, -1)
  assert.ok(checkoutIndex < retryIndex, 'stage checkout must precede the bounded tag refresh')
  assert.ok(retryIndex < guardIndex, 'bounded tag refresh must precede the stage-time commit guard')
  assert.ok(guardIndex < metadataIndex, 'stage-time commit guard must pass before metadata generation')
  assert.ok(guardIndex < draftCreationIndex, 'stage-time commit guard must pass before draft creation')
  assert.match(guard, /TAG: \$\{\{ needs\.verify\.outputs\.tag \}\}/)
  assert.match(guard, /EXPECTED_COMMIT: \$\{\{ needs\.verify\.outputs\.commit \}\}/)
  const retry = stage.slice(retryIndex, guardIndex)
  assert.match(retry, /uses: \.\/\.github\/actions\/retry/)
  assert.match(retry, /command: git fetch --force origin "refs\/tags\/\$TAG:refs\/tags\/\$TAG"/)
  assert.match(retry, /attempts: '5'/)
  assert.match(retry, /delay: '15'/)
  assert.doesNotMatch(guard, /git fetch/)
  assert.match(guard, /head_commit="\$\(git rev-parse HEAD\)"/)
  assert.match(guard, /tag_commit="\$\(git rev-list -n 1 "\$TAG"\)"/)
  assert.match(guard, /test "\$head_commit" = "\$EXPECTED_COMMIT"/)
  assert.match(guard, /test "\$tag_commit" = "\$EXPECTED_COMMIT"/)
  assert.doesNotMatch(stage, /gh release create "\$TAG"[^\r\n]*--target/)
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
  assert.match(promotion, /expected_make_latest=false/)
  assert.match(promotion, /\[\[ "\$RELEASE_CLASS" == "stable" \]\] && expected_make_latest=true/)
  assert.match(
    promotion,
    /-F draft=false -F prerelease="\$expected_prerelease" -f make_latest="\$expected_make_latest"/
  )
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
  assert.match(promotion, /-F draft=true -F prerelease="\$expected_prerelease" -f make_latest=false/)
  assert.match(promotion, /publication-response-api\.json/)
  assert.match(promotion, /releases\/latest/)
  assert.match(promotion, /test "\$latest_tag" = "\$previous_latest"/)
  assert.match(promotion, /test "\$latest_id" = "\$previous_latest_id"/)
  assert.equal((promotion.match(/^\s*validateStablePromotionOrder\(\{/gm) ?? []).length, 1)
  assert.match(promotion, /PREVIOUS_LATEST="\$previous_latest"/)
  assert.match(promotion, /previousLatestTag: process\.env\.PREVIOUS_LATEST/)
  assert.ok(
    promotion.indexOf('validateStablePromotionOrder({') < promotion.indexOf('rollback_publication'),
    'stable promotion must prove monotonic Latest order before mutation'
  )
  assert.equal(
    (promotion.match(/^\s*validateVietnameseReleasePresentation\(\{/gm) ?? []).length,
    2,
    'general promotion must exact-check the release presentation before and after mutation'
  )
  assert.equal((promotion.match(/const candidate = resolveVietnameseReleaseCandidate/g) ?? []).length, 2)
  assert.match(promotion, /expectedBody: fs\.readFileSync\('\.github\/release-notes-vietnamese\.md', 'utf8'\)/)
  assert.match(promotion, /release-api\.json > candidate-release\.json/)
  assert.match(promotion, /published-release-api\.json > published-release\.json/)
  assert.equal((promotion.match(/^\s*validateFeaturedCandidatePromotion\(\{/gm) ?? []).length, 1)
  assert.equal((promotion.match(/^\s*validateVietnameseReleaseNotesForClass\(\{/gm) ?? []).length, 1)
  assert.match(promotion, /process\.env\.RELEASE_CLASS === 'community-prerelease'/)
  assert.match(promotion, /releaseClass: process\.env\.RELEASE_CLASS/)
  assert.match(promotion, /featuredCandidate: publicRelease\.featuredCandidate/)
  assert.match(promotion, /tag: process\.env\.TAG/)
  assert.ok(
    promotion.indexOf('validateFeaturedCandidatePromotion({') < promotion.indexOf('rollback_publication'),
    'general prerelease promotion must bind its exact public callout before mutation'
  )
  assert.ok(
    promotion.indexOf('validateVietnameseReleasePresentation') < promotion.indexOf('rollback_publication'),
    'general promotion must reject a stale title/body before any publication mutation is prepared'
  )
  assert.ok(
    promotion.lastIndexOf('validateVietnameseReleasePresentation') >
      promotion.lastIndexOf('publication-response-api.json'),
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

test('v32 runtime smoke binds the exact candidate to an ephemeral Windows lifecycle VM', () => {
  assert.match(runtimeSmoke, /v32-windows-lifecycle:/)
  assert.match(runtimeSmoke, /if: inputs\.tag == 'vi-v0\.32\.0-1' && inputs\.release_class == 'community-prerelease'/)
  assert.match(runtimeSmoke, /v32-windows-lifecycle:[\s\S]*?permissions:\r?\n\s+contents: write/)
  assert.match(runtimeSmoke, /runs-on: windows-2025/)
  assert.match(runtimeSmoke, /node-version: 26\.5\.1/)
  assert.match(runtimeSmoke, /--isolation-mode github-hosted-ephemeral-vm/)
  assert.match(runtimeSmoke, /--candidate-commit 81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f/)
  assert.match(runtimeSmoke, /--harness-commit \$env:GITHUB_SHA/)
  assert.match(runtimeSmoke, /--previous-sha256 cca0f3c0255e5e8736676a4d7ccb52c6e1b75eb73b94b8d1c3ca5dc91e57e840/)
  assert.match(runtimeSmoke, /--rollback-sha256 e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31/)
  assert.match(runtimeSmoke, /releases\?per_page=100/)
  assert.match(runtimeSmoke, /\$release\.draft -ne \$true -or \$release\.prerelease -ne \$true/)
  assert.match(runtimeSmoke, /\$asset\.digest -ne "sha256:\$\(\$env:CANDIDATE_SHA256\.ToLowerInvariant\(\)\)"/)
  assert.match(runtimeSmoke, /Invoke-WebRequest -Uri \$asset\.url -Headers \$headers -OutFile \$candidatePath/)
  assert.match(runtimeSmoke, /Join-Path \$env:RUNNER_TEMP 'hermes-v32-release-inputs'/)
  assert.match(lifecycleRunner, /resolveLifecycleStagingRoot/)
  assert.match(lifecycleRunner, /runnerTemp: process\.env\.RUNNER_TEMP/)
  assert.match(lifecycleRunner, /fs\.mkdtempSync\(path\.join\(stagingRoot/)
  assert.doesNotMatch(lifecycleRunner, /fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\)/)
  assert.match(lifecycleRunner, /maxRetries: 12/)
  assert.match(lifecycleRunner, /retryDelay: 250/)
  assert.match(lifecycleRunner, /receiptExists && exit/)
  assert.doesNotMatch(runtimeSmoke, /New-Item -ItemType Directory -Path candidate, previous, rollback/)
  assert.match(runtimeSmoke, /actions\/cache\/restore@0400d5f644dc74513175e3cd8d07132dd4860809/)
  assert.match(runtimeSmoke, /actions\/cache\/save@0400d5f644dc74513175e3cd8d07132dd4860809/)
  assert.match(runtimeSmoke, /if \(\$env:CACHE_HIT -ne 'true'\)/)
  assert.match(runtimeSmoke, /if \(\$LASTEXITCODE -ne 0\) \{ throw 'Cannot download pinned v31 installer' \}/)
  assert.match(runtimeSmoke, /workflow-preflight\.json/)
  assert.match(runtimeSmoke, /draft-download-attempt\.json/)
  assert.match(runtimeSmoke, /path: C:\\HermesEvidence/)
  assert.match(
    runtimeSmoke,
    /path: C:\\HermesEvidence\r?\n\s+include-hidden-files: true/,
    'lifecycle archive must retain Playwright hidden receipts covered by its manifest'
  )
  assert.match(runtimeSmoke, /if: always\(\)/)
})

test('v32.1 safety update is an explicit unsigned x64 community pilot with its own exact lifecycle lane', () => {
  const v321Start = runtimeSmoke.indexOf('\n  v321-windows-lifecycle:')
  assert.notEqual(v321Start, -1)
  const v321Lane = runtimeSmoke.slice(v321Start)
  assert.doesNotMatch(candidate, /matrix\.id == 'windows-x64' && needs\.verify\.outputs\.tag == 'vi-v0\.32\.1-15'/)
  assert.match(candidate, /build_matrix: \$\{\{ steps\.candidate\.outputs\.build_matrix \}\}/)
  assert.match(candidate, /if \[\[ "\$RELEASE_TAG" == "vi-v0\.32\.1-15" \]\]/)
  assert.match(candidate, /matrix: \$\{\{ fromJSON\(needs\.verify\.outputs\.build_matrix\) \}\}/)
  assert.match(runtimeSmoke, /exact-bytes:[\s\S]*?inputs\.tag != 'vi-v0\.32\.1-15'/)
  assert.match(runtimeSmoke, /evidence:[\s\S]*?inputs\.tag != 'vi-v0\.32\.1-15'/)
  assert.match(runtimeSmoke, /windows_x64_sha256:/)
  assert.match(runtimeSmoke, /v321-windows-lifecycle:/)
  assert.match(v321Lane, /if: inputs\.tag == 'vi-v0\.32\.1-15' && inputs\.release_class == 'community-prerelease'/)
  assert.match(v321Lane, /permissions:\s+#[^\n]*\n\s+#[^\n]*\n\s+contents: write/)
  assert.match(v321Lane, /git rev-list -n 1 \$env:TAG/)
  assert.match(v321Lane, /gh @Arguments/)
  assert.match(v321Lane, /release', 'view', \$env:TAG/)
  assert.doesNotMatch(v321Lane, /releases\?per_page=100.*--slurp/)
  assert.match(runtimeSmoke, /ref: \$\{\{ inputs\.tag \}\}/)
  assert.doesNotMatch(v321Lane, /gh api .*commits/)
  assert.match(v321Lane, /CANDIDATE_COMMIT=\$expectedCommit/)
  assert.match(v321Lane, /'release', 'download', 'vi-v0\.32\.0-1'/)
  assert.match(v321Lane, /--candidate-commit \$env:CANDIDATE_COMMIT/)
  assert.match(v321Lane, /--harness-commit \$env:CANDIDATE_COMMIT/)
  assert.match(v321Lane, /--previous-sha256 efc3d863a37882c669d571456711264e2aa4f60b66bf9e67ff2441ce491ceeac/)
  assert.match(v321Lane, /v32\.1 community candidate must be explicitly NotSigned/)
  assert.match(candidate, /authenticode_status=/)
  assert.match(candidate, /signer_present=/)
  assert.match(v321Lane, /v321-windows-lifecycle-\$\{\{ github\.run_id \}\}/)
  assert.match(v321Promotion, /^name: Công khai Hermes Vietnamese v32\.1$/m)
  assert.equal((v321Promotion.match(/TAG: vi-v0\.32\.1-15/g) ?? []).length, 2)
  assert.match(v321Promotion, /node scripts\/validate-v321-promotion\.mjs/)
  assert.match(v321Promotion, /test "\$previous_latest" = vi-v0\.32\.0-1/)
  assert.match(v321Promotion, /-F draft=true -F prerelease=true -f make_latest=false/)
  assert.match(v321Promotion, /rollback-v321-verify\.json/)
  assert.match(v321Promotion, /-f make_latest=true/)
  assert.match(v321Promotion, /assert_tag_binding/)
})

test('v32 promotion revalidates private bytes and full lifecycle evidence before publication', () => {
  assert.match(v32Promotion, /environment: release-production/)
  assert.match(v32Promotion, /^\s*group: hermes-vietnamese-promotion$/m)
  assert.match(v32Promotion, /CONTROLLER_SHA: \$\{\{ inputs\.controller_sha \}\}/)
  assert.match(v32Promotion, /test "\$CONTROLLER_SHA" = "\$DISPATCH_SHA"/)
  assert.match(v32Promotion, /test "\$tag_commit" = 81a0c7c53c6e0a42ba56af82c0bc72eb31727b0f/)
  assert.match(v32Promotion, /gh run download "\$LIFECYCLE_RUN_ID"/)
  assert.equal((v32Promotion.match(/node scripts\/validate-v32-promotion\.mjs/g) ?? []).length, 2)
  assert.match(v32Promotion, /"\$EXPECTED_MANIFEST_SHA" "\$LIFECYCLE_RUN_ID" draft/)
  assert.match(v32Promotion, /"\$EXPECTED_MANIFEST_SHA" "\$LIFECYCLE_RUN_ID" latest/)
  assert.match(v32Promotion, /-F draft=false -F prerelease=false -f make_latest=true/)
  assert.match(v32Promotion, /-F draft=true -F prerelease=true -f make_latest=false/)
  assert.match(v32Promotion, /test "\$previous_latest" = vi-v0\.31\.0-7/)
  assert.match(v32Promotion, /releases\/\$previous_latest_id.*make_latest=true/s)
  assert.match(v32Promotion, /test "\$\(jq -r \.tag_name latest-release\.json\)" = "\$TAG"/)
  assert.doesNotMatch(v32Promotion, /git tag|git push|refs\/tags\/.*--force/)
  assert.match(v32PromotionValidator, /run\.name !== 'Kiểm thử runtime artifact Hermes Vietnamese'/)
})

test('pilot promotion stays prerelease, validates every byte, and discloses missing native smoke', () => {
  assert.match(pilotPromotion, /environment: release-production/)
  assert.match(pilotPromotion, /^\s*group: hermes-vietnamese-promotion$/m)
  assert.doesNotMatch(pilotPromotion, /group: hermes-vietnamese-pilot-promotion-/)
  assert.match(pilotPromotion, /controller_sha:\r?\n\s+description:.*\r?\n\s+required: true\r?\n\s+type: string/)
  const stepsIndex = pilotPromotion.indexOf('    steps:')
  const controllerGateIndex = pilotPromotion.indexOf('      - name: Khóa commit điều khiển promotion')
  const checkoutIndex = pilotPromotion.indexOf('      - uses: actions/checkout@')
  assert.notEqual(stepsIndex, -1)
  assert.notEqual(controllerGateIndex, -1)
  assert.notEqual(checkoutIndex, -1)
  assert.equal(
    pilotPromotion.indexOf('      - ', stepsIndex),
    controllerGateIndex,
    'controller binding must be the first promotion step'
  )
  assert.ok(controllerGateIndex < checkoutIndex, 'controller binding must pass before checkout')
  const controllerGate = pilotPromotion.slice(controllerGateIndex, checkoutIndex)
  assert.match(controllerGate, /CONTROLLER_SHA: \$\{\{ inputs\.controller_sha \}\}/)
  assert.match(controllerGate, /DISPATCH_SHA: \$\{\{ github\.sha \}\}/)
  assert.ok(controllerGate.includes('^([0-9a-f]{40})$') || controllerGate.includes('^[0-9a-f]{40}$'))
  assert.match(controllerGate, /test "\$CONTROLLER_SHA" = "\$DISPATCH_SHA"/)
  assert.match(pilotPromotion, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/)
  assert.match(pilotPromotion, /ref: \$\{\{ inputs\.tag \}\}/)
  assert.match(pilotPromotion, /replace\(\/\\s\+\/gu, ' '\)/)
  assert.match(pilotPromotion, /const wrappedFixture =/)
  assert.match(pilotPromotion, /assert\.equal\(validatePilotDisclosures\(wrappedFixture\), true\)/)
  assert.match(pilotPromotion, /assert\.throws\(/)
  assert.match(pilotPromotion, /wrappedFixture\.replace\('SignPath', ''\)/)
  assert.match(pilotPromotion, /validatePilotDisclosures\(process\.env\.RELEASE_BODY\)/)
  assert.doesNotMatch(pilotPromotion, /grep -Fq 'Windows x64: exact-artifact smoke đạt'/)
  assert.doesNotMatch(pilotPromotion, /grep -Fq 'chưa có smoke trên máy người dùng'/)
  assert.match(pilotPromotion, /test "\$\(git rev-parse HEAD\)" = "\$candidate_commit"/)
  assert.match(pilotPromotion, /validate-pilot-release-evidence\.mjs/)
  assert.match(pilotPromotion, /Dựng và staging Hermes Vietnamese/)
  assert.match(pilotPromotion, /sha256sum --check SHA256SUMS\.txt/)
  assert.match(pilotPromotion, /browser_download_url/)
  assert.match(pilotPromotion, /draft asset inventory mismatch/)
  assert.match(pilotPromotion, /rollback_publication/)
  assert.match(pilotPromotion, /-F draft=true -F prerelease=true -f make_latest=false/)
  assert.match(pilotPromotion, /-F draft=false -F prerelease=true -f make_latest=false/)
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
  assert.match(pilotPromotion, /release-api\.json > candidate-release\.json/)
  assert.match(pilotPromotion, /published-release-api\.json > published-release\.json/)
  assert.equal((pilotPromotion.match(/^\s*validateFeaturedCandidatePromotion\(\{/gm) ?? []).length, 1)
  assert.equal((pilotPromotion.match(/^\s*validateVietnameseReleaseNotesForClass\(\{/gm) ?? []).length, 1)
  assert.match(pilotPromotion, /releaseClass: 'community-prerelease'/)
  assert.match(pilotPromotion, /featuredCandidate: publicRelease\.featuredCandidate/)
  assert.match(pilotPromotion, /tag: process\.env\.TAG/)
  assert.match(
    pilotPromotion,
    /committed_latest="\$\(node -p "require\('\.\/\.github\/public-release\.json'\)\.tag"\)"/
  )
  assert.match(pilotPromotion, /test "\$previous_latest" = "\$committed_latest"/)
  assert.match(pilotPromotion, /test "\$TAG" != "\$previous_latest"/)
  assert.ok(
    pilotPromotion.indexOf('validateFeaturedCandidatePromotion({') < pilotPromotion.indexOf('rollback_publication'),
    'pilot promotion must bind its exact public callout before mutation'
  )
  assert.ok(
    pilotPromotion.indexOf('tests/test_public_release_downloads.py') < pilotPromotion.indexOf('rollback_publication'),
    'pilot promotion must validate prepared public callouts before publication'
  )
  assert.ok(
    pilotPromotion.lastIndexOf('validateVietnameseReleasePresentation') >
      pilotPromotion.lastIndexOf('publication-response-api.json'),
    'pilot promotion must recheck the title/body after publication'
  )
  assert.ok(
    pilotPromotion.indexOf('test "$previous_latest" = "$committed_latest"') <
      pilotPromotion.lastIndexOf('publication-response-api.json'),
    'pilot promotion must bind live Latest to the committed default before publication'
  )
  assert.doesNotMatch(pilotPromotion, /--prerelease=false/)
})

test('promotion controllers bind one private draft and defer canonical URLs until publication', () => {
  for (const [label, workflow] of [
    ['general', promotion],
    ['pilot', pilotPromotion]
  ]) {
    const publicationIndex = workflow.indexOf('      - name: Công khai, hậu kiểm')
    assert.notEqual(publicationIndex, -1, `${label}: publication step is missing`)

    const preflight = workflow.slice(0, publicationIndex)
    const postpublication = workflow.slice(publicationIndex)

    assert.match(
      preflight,
      /gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100" --slurp > release-pages\.json/,
      `${label}: private drafts must be resolved through the paginated release collection`
    )
    assert.match(preflight, /select\(\.tag_name == \$tag\)/)
    assert.match(preflight, /test "\$\(jq 'length' release-matches\.json\)" = "1"/)
    assert.match(preflight, /release_id="\$\(jq -r \.id release-api\.json\)"/)
    assert.match(preflight, /\[\[ "\$release_id" =~ \^\[1-9\]\[0-9\]\*\$ \]\]/)
    assert.match(preflight, /test "\$\(jq -r \.tag_name release-api\.json\)" = "\$TAG"/)
    assert.match(preflight, /test "\$\(jq -r \.draft release-api\.json\)" = "true"/)
    if (label === 'pilot') {
      assert.match(preflight, /test "\$\(jq -r \.prerelease release-api\.json\)" = "true"/)
    } else {
      assert.match(preflight, /test "\$\(jq -r \.prerelease release-api\.json\)" = "\$expected_draft_prerelease"/)
    }
    assert.match(preflight, /releases\/\$release_id\/assets\?per_page=100/)
    assert.match(preflight, /createHash\('sha256'\)/)
    assert.match(preflight, /createReadStream\(file\)/)
    assert.match(preflight, /asset\.digest !== digest/)
    assert.doesNotMatch(preflight, /releases\/tags\/\$TAG/)
    assert.match(preflight, /browser_download_url/)
    assert.match(preflight, /draft asset URL shape mismatch/)
    assert.doesNotMatch(preflight, /browser_download_url !== prefix \+ asset\.name/)
    assert.ok(
      preflight.indexOf('release-matches.json') < preflight.indexOf('gh release download "$TAG"'),
      `${label}: the unique draft binding must precede every candidate download`
    )

    assert.match(
      postpublication,
      /gh api "repos\/\$GITHUB_REPOSITORY\/releases\/tags\/\$TAG" > published-release-api\.json/,
      `${label}: only the public release may be resolved through the tag endpoint`
    )
    assert.match(
      postpublication,
      /gh api "repos\/\$GITHUB_REPOSITORY\/releases\/\$release_id" > prepublish-release-api\.json/
    )
    assert.match(postpublication, /test "\$\(jq -r \.id prepublish-release-api\.json\)" = "\$release_id"/)
    assert.match(postpublication, /test "\$\(jq -r \.tag_name prepublish-release-api\.json\)" = "\$TAG"/)
    assert.match(postpublication, /test "\$\(jq -r \.draft prepublish-release-api\.json\)" = "true"/)
    if (label === 'pilot') {
      assert.match(postpublication, /test "\$\(jq -r \.prerelease prepublish-release-api\.json\)" = "true"/)
    } else {
      assert.match(
        postpublication,
        /test "\$\(jq -r \.prerelease prepublish-release-api\.json\)" = "\$expected_prerelease"/
      )
    }
    assert.match(
      postpublication,
      /test "\$\(jq -r \.id published-release-api\.json\)" = "\$\(jq -r \.id release-api\.json\)"/
    )
    assert.match(postpublication, /test "\$\(jq -r \.tag_name published-release-api\.json\)" = "\$TAG"/)
    assert.match(postpublication, /test "\$\(jq -r \.draft published-release-api\.json\)" = "false"/)
    assert.match(postpublication, /https:\/\/github\.com\/\$GITHUB_REPOSITORY\/releases\/tag\/\$TAG/)
    if (label === 'pilot') {
      assert.match(postpublication, /test "\$\(jq -r \.prerelease published-release-api\.json\)" = "true"/)
    } else {
      assert.match(
        postpublication,
        /test "\$\(jq -r \.prerelease published-release-api\.json\)" = "\$expected_prerelease"/
      )
    }
    assert.match(postpublication, /releases\/\$published_release_id\/assets\?per_page=100/)
    assert.match(postpublication, /browser_download_url/)
    assert.match(postpublication, /releases\/download\/\$\{process\.env\.TAG\}\//)
    assert.match(postpublication, /asset\.digest !== staged\.digest/)
    const trapIndex = postpublication.indexOf('trap rollback_publication ERR')
    const publicationEditIndex = postpublication.indexOf(
      'gh api --method PATCH "repos/$GITHUB_REPOSITORY/releases/$release_id"',
      trapIndex
    )
    const publicTagLookupIndex = postpublication.indexOf('releases/tags/$TAG" > published-release-api.json')
    assert.ok(
      postpublication.indexOf('releases/$release_id" > prepublish-release-api.json') < publicationEditIndex,
      `${label}: the selected release ID must still be the same draft immediately before mutation`
    )
    assert.ok(
      trapIndex !== -1 && publicationEditIndex > trapIndex && publicTagLookupIndex > publicationEditIndex,
      `${label}: the canonical tag endpoint is valid only after publication`
    )
  }
})

test('promotion controllers preserve the remote tag and fail closed on exact-ID rollback', () => {
  for (const [label, workflow] of [
    ['general', promotion],
    ['pilot', pilotPromotion]
  ]) {
    const publicationIndex = workflow.indexOf('      - name: Công khai, hậu kiểm')
    const preflight = workflow.slice(0, publicationIndex)
    const postpublication = workflow.slice(publicationIndex)

    assert.match(preflight, /git\/ref\/tags\/\$TAG/)
    assert.match(preflight, /git\/tags\/\$tag_ref_object/)
    assert.match(preflight, /candidate-tag-binding\.json/)
    assert.match(preflight, /peeledCommit/)
    assert.match(preflight, /new URL\(api\.html_url\)/)
    assert.match(preflight, /draftPagePrefix = `\/\$\{process\.env\.REPOSITORY\}\/releases\/tag\/`/)
    assert.match(preflight, /releaseRoute !== process\.env\.TAG/)
    assert.match(preflight, /\^untagged-/)
    assert.doesNotMatch(preflight, /browser_download_url !== prefix \+ asset\.name/)

    assert.match(postpublication, /assert_tag_binding\(\)/)
    assert.equal(
      (postpublication.match(/^\s*assert_tag_binding$/gm) ?? []).length,
      2,
      `${label}: tag identity must be checked immediately before and after publication`
    )
    assert.match(postpublication, /gh api --method PATCH "repos\/\$GITHUB_REPOSITORY\/releases\/\$release_id"/)
    assert.doesNotMatch(postpublication, /gh release edit "\$TAG"/)
    assert.match(postpublication, /original_status=\$\?/)
    assert.match(postpublication, /rollback-release-verify\.json/)
    assert.match(postpublication, /rollback-latest-verify\.json/)
    assert.match(postpublication, /releases\/\$previous_latest_id/)
    assert.match(postpublication, /Rollback verification failed/)
    assert.match(postpublication, /return "\$original_status"/)
    assert.doesNotMatch(postpublication, /\|\| true/)
  }
})

test('release verification commands identify the repository outside a checkout', () => {
  assert.match(promotion, /gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100"/)
  assert.match(promotion, /gh release download "\$TAG" --repo "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /gh run download "\$SMOKE_RUN_ID" --repo "\$GITHUB_REPOSITORY"/)
  assert.match(promotion, /gh api --method PATCH "repos\/\$GITHUB_REPOSITORY\/releases\/\$release_id"/)
})

test('the ordinary packaged desktop gate installs uv before invoking the build', () => {
  assert.match(jsTests, /matrix\.script == 'check:test:desktop:all'/)
  assert.match(jsTests, /astral-sh\/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39/)
})
