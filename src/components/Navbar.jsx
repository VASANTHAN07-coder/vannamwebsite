import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Globe, Droplet, Sun, Moon } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import styles from './Navbar.module.css';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { language, setLanguage, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();

    const toggleMenu = () => setIsOpen(!isOpen);

    const languages = [
        { code: 'en', label: 'En' },
        { code: 'ta', label: 'தமிழ்' },
        { code: 'de', label: 'De' },
        { code: 'es', label: 'Es' }
    ];

    return (
        <nav className={styles.navbar}>
            <div className={`container ${styles.navContainer}`}>
                <NavLink to="/" className={styles.logo}>
                    <Droplet className={styles.logoIcon} />
                    {/* We will handle the multicolor text in CSS or inline style here, but user asked for VANNAM specifically on Home maybe? Or logo? Let's make logo gradient everywhere */}
                    <span className={styles.logoText}>Vannam</span>
                </NavLink>

                <div className={`${styles.navLinks} ${isOpen ? styles.active : ''}`}>
                    <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : ''}>
                        {t('nav.home')}
                    </NavLink>
                    <NavLink to="/visualizer" onClick={() => setIsOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : ''}>
                        {t('nav.visualizer')}
                    </NavLink>
                    <NavLink to="/products" onClick={() => setIsOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : ''}>
                        {t('nav.products')}
                    </NavLink>
                    <NavLink to="/about" onClick={() => setIsOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : ''}>
                        {t('nav.about')}
                    </NavLink>
                    <NavLink to="/connect" onClick={() => setIsOpen(false)} className={({ isActive }) => isActive ? styles.activeLink : ''}>
                        {t('nav.connect')}
                    </NavLink>

                    <div className={styles.actions}>
                        <button className={styles.themeBtn} onClick={toggleTheme} title="Toggle Theme">
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <div className={styles.langSelectWrapper}>
                            <Globe size={16} className={styles.langIcon} />
                            <select
                                value={language}
                                onChange={(e) => {
                                    setLanguage(e.target.value);
                                    setIsOpen(false);
                                }}
                                className={styles.langSelect}
                            >
                                {languages.map(lang => (
                                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <button className={styles.menuBtn} onClick={toggleMenu}>
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
