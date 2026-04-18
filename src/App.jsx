import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import YtMp4Page from './pages/YtMp4Page'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ytmp4" element={<YtMp4Page />} />
      </Routes>
    </BrowserRouter>
  )
}
