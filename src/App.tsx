import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from '@/components/shell/Layout'
import { SoundProvider } from '@/lib/sound'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const Home = lazy(() => import('@/pages/Home'))
const Inbox = lazy(() => import('@/pages/Inbox'))
const Requests = lazy(() => import('@/pages/Requests'))
const Findings = lazy(() => import('@/pages/Findings'))
const Procurement = lazy(() => import('@/pages/Procurement'))
const Receivables = lazy(() => import('@/pages/Receivables'))
const Assets = lazy(() => import('@/pages/Assets'))
const Checks = lazy(() => import('@/pages/Checks'))
const Report = lazy(() => import('@/pages/Report'))
const Field = lazy(() => import('@/pages/Field'))

export default function App() {
  return (
    <SoundProvider>
      <TooltipProvider delayDuration={300}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Suspense><Home /></Suspense>} />
              <Route path="inbox" element={<Suspense><Inbox /></Suspense>} />
              <Route path="requests" element={<Suspense><Requests /></Suspense>} />
              <Route path="findings" element={<Suspense><Findings /></Suspense>} />
              <Route path="findings/:id" element={<Suspense><Findings /></Suspense>} />
              <Route path="procurement" element={<Suspense><Procurement /></Suspense>} />
              <Route path="receivables" element={<Suspense><Receivables /></Suspense>} />
              <Route path="assets" element={<Suspense><Assets /></Suspense>} />
              <Route path="checks" element={<Suspense><Checks /></Suspense>} />
              <Route path="report" element={<Suspense><Report /></Suspense>} />
              <Route path="field" element={<Suspense><Field /></Suspense>} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </SoundProvider>
  )
}
