import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ExternalLink, Info, Package, RefreshCw } from '@/lib/icons'
import productMetadata from '@/plugins/hermes-vietnamese/product-metadata.json'
import { $desktopVersion, refreshDesktopVersion } from '@/store/updates'

import { ListRow, SectionHeading, SettingsContent } from './primitives'
import { UninstallSection } from './uninstall-section'

const RELEASES_URL = productMetadata.communityLinks.releases

function openExternal(url: string) {
  void window.hermesDesktop?.openExternal?.(url)
}

export function AboutSettings() {
  const runtime = useStore($desktopVersion)

  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  const runningEngineVersion = runtime?.engineVersion
  const expectedEngineVersion = productMetadata.upstream.version
  const engineMismatch = Boolean(runningEngineVersion && runningEngineVersion !== expectedEngineVersion)
  const runtimeMismatch = runtime?.runtimeProductVersion !== productMetadata.technicalVersion

  return (
    <SettingsContent>
      <div className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
        <BrandMark className="size-16" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{productMetadata.displayName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {productMetadata.productVersion} · {productMetadata.technicalVersion}
          </p>
          <p className="mt-2 text-sm text-foreground">
            Phát triển và Việt hóa bởi {productMetadata.communityMaintainer.name}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl">
        <SectionHeading icon={Info} title="Thông tin phát hành" />
        <ListRow
          description={`Nền chính thức: ${productMetadata.upstream.publisher} · ${productMetadata.upstream.tag}`}
          hint={productMetadata.upstream.commit.slice(0, 12)}
          title={`${productMetadata.upstream.productName} ${expectedEngineVersion}`}
        />
        <ListRow
          description={runtime?.runtimeCandidateId ?? 'Chưa có biên nhận runtime đã xác minh'}
          hint={runtime?.runtimeSourceCommit?.slice(0, 12) ?? 'Không xác định'}
          title={`Runtime Advisor đang chạy · ${runtime?.runtimeProductVersion ?? 'không xác định'}`}
        />

        {engineMismatch ? (
          <div className="my-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium">Lõi đang chạy chưa khớp với bản phát hành</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Hồ sơ cũ đang dùng Hermes Agent {runningEngineVersion}; bản này khóa {expectedEngineVersion}. Không
                  cập nhật trực tiếp checkout lõi. Hãy chọn “Gỡ GUI + agent, giữ dữ liệu”, rồi chạy lại bộ cài Hermes
                  Vietnamese mới nhất.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {runtimeMismatch ? (
          <div className="my-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <div>
                <p className="font-medium">Runtime Advisor không khớp giao diện Experimental</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Ứng dụng sẽ không được coi là đạt kiểm thử cho đến khi runtime {productMetadata.technicalVersion} có
                  biên nhận và hash hợp lệ. Hãy đóng ứng dụng rồi mở bằng lối tắt Experimental để đồng bộ lại.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <SectionHeading icon={RefreshCw} title="Cập nhật" />
        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <Package className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium">Kênh Experimental riêng · cập nhật bằng bộ cài thử nghiệm</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Bản này dùng runtime Advisor cô lập từ mã PR chưa hợp nhất và không thay Hermes Vietnamese ổn định.
                Mỗi lần mở đều xác minh candidate trước khi khởi chạy.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => openExternal(RELEASES_URL)} size="sm" variant="textStrong">
              <ExternalLink className="size-3" />
              Xem kho Hermes Vietnamese
            </Button>
            <span className="text-xs text-muted-foreground">Tự động cập nhật: tắt ở kênh Experimental</span>
          </div>
        </div>

        <UninstallSection />
      </div>
    </SettingsContent>
  )
}
