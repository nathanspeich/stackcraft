import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Home from './screens/Home'
import MapScreen from './screens/Map'
import LessonScreen from './screens/Lesson'
import Flashcards from './screens/Flashcards'
import Profile from './screens/Profile'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="map" element={<MapScreen />} />
        <Route path="lesson/:id" element={<LessonScreen />} />
        <Route path="cards" element={<Flashcards />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
