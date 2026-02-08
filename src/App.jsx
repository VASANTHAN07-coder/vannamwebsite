import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Visualizer from './pages/Visualizer';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import styles from './App.module.css';

// Simple placeholders for other pages
const Products = () => (
  <div className="container" style={{ padding: '4rem 0' }}>
    <h1 className="title-gradient">International Paint Products</h1>
    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
      Explore our vast collection of colors from top international brands like Asian Paints, Dulux, Nippon, and more.
      <br /><br />
      (Full database integration coming soon)
    </p>
  </div>
);

const About = () => (
  <div className="container" style={{ padding: '4rem 0' }}>
    <h1 className="title-gradient">About Vannam</h1>
    <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
      <h3 style={{ color: 'var(--text-main)' }}>Our Mission</h3>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        To revolutionize the house painting industry with autonomous robotics. The Vannam Rover is designed to reach where humans shouldn't risk going.
      </p>
    </div>
  </div>
);

const Connect = () => (
  <div className="container" style={{ padding: '4rem 0' }}>
    <h1 className="title-gradient">Connect With Us</h1>
    <form className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', maxWidth: '600px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Name</label>
        <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Email</label>
        <input type="email" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Message</label>
        <textarea rows="4" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}></textarea>
      </div>
      <button className="btn-primary">Send Message</button>
    </form>
  </div>
);

const Footer = () => (
  <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--glass-border)', padding: '2rem 0', marginTop: 'auto' }}>
    <div className="container" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
      <p>&copy; 2024 Vannam Robotics | Team <strong>Innova18</strong></p>
    </div>
  </footer>
);

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Router>
          <div className={styles.appContainer}>
            <div className={styles.bgGradient}></div>
            <Navbar />
            <main className={styles.mainContent}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/visualizer" element={<Visualizer />} />
                <Route path="/products" element={<Products />} />
                <Route path="/about" element={<About />} />
                <Route path="/connect" element={<Connect />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
