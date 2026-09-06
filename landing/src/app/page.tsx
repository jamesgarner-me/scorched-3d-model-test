import { ModelDirectory } from '@/components/model-directory'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { StructuredData } from '@/components/structured-data'
import { modelSites } from '@/lib/models'

export default function HomePage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl grow content-start gap-10 px-4 py-16 sm:py-24">
      <StructuredData sites={modelSites} />
      <SiteHeader />
      <ModelDirectory sites={modelSites} />
      <SiteFooter />
    </main>
  )
}
