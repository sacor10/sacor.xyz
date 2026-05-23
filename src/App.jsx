import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import YtMp4Page from './pages/YtMp4Page'
import YoutubeDownloaderPage from './pages/YoutubeDownloaderPage'
import InstagramDownloaderPage from './pages/InstagramDownloaderPage'
import XDownloaderPage from './pages/XDownloaderPage'
import TikTokDownloaderPage from './pages/TikTokDownloaderPage'
import MtsPage from './pages/MtsPage'
import WebringPage from './pages/WebringPage'
import BlogIndexPage from './pages/BlogIndexPage'
import BlogPostPage from './pages/BlogPostPage'
import QuotesPage from './pages/QuotesPage'
import ContactPage from './pages/ContactPage'
import GuestbookPage from './pages/GuestbookPage'
import StocksPage from './pages/StocksPage'
import TravelPlansPage from './pages/TravelPlansPage'
import TravelPlanPage from './pages/TravelPlanPage'
import { AuthProvider } from './auth/AuthContext.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ytmp4" element={<YtMp4Page />} />
          <Route path="/youtube-downloader" element={<YoutubeDownloaderPage />} />
          <Route path="/instagram-downloader" element={<InstagramDownloaderPage />} />
          <Route path="/x-downloader" element={<XDownloaderPage />} />
          <Route path="/tiktok-downloader" element={<TikTokDownloaderPage />} />
          <Route path="/mts" element={<MtsPage />} />
          <Route path="/webring" element={<WebringPage />} />
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/quotes" element={<QuotesPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/travel-plans" element={<TravelPlansPage />} />
          <Route path="/travel-plans/:id" element={<TravelPlanPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
