import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import YtMp4Page from './pages/YtMp4Page'
import MtsPage from './pages/MtsPage'
import WebringPage from './pages/WebringPage'
import BlogIndexPage from './pages/BlogIndexPage'
import BlogPostPage from './pages/BlogPostPage'
import ContactPage from './pages/ContactPage'
import GuestbookPage from './pages/GuestbookPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ytmp4" element={<YtMp4Page />} />
        <Route path="/mts" element={<MtsPage />} />
        <Route path="/webring" element={<WebringPage />} />
        <Route path="/blog" element={<BlogIndexPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/guestbook" element={<GuestbookPage />} />
      </Routes>
    </BrowserRouter>
  )
}
