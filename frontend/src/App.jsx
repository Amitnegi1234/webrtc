import {BrowserRouter as Router,Routes,Route} from "react-router-dom"
import './App.css'
import Auth from "./pages/auth/Auth"
import Dashboard from "./pages/dashboard/Dashboard"
import IsLogin from "./pages/auth/isLogin"

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<IsLogin/>}>
          <Route path="/" element={<Dashboard/>}></Route>
        </Route>
        <Route path="/signup" element={<Auth type="signup"></Auth>}></Route>
        <Route path="/login" element={<Auth type="login"></Auth>}></Route>
      </Routes>
    </Router>
  )
}

export default App
