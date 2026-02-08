import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Smartphone, Bluetooth, Paintbrush, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import styles from './Home.module.css';

const Home = () => {
    const { t } = useLanguage();

    return (
        <div className={styles.home}>
            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={`container ${styles.heroContainer}`}>
                    <motion.div
                        className={styles.heroContent}
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className={styles.heroTitle}>{t('hero.title')}</h1>
                        <p className={styles.subtitle}>{t('hero.subtitle')}</p>
                        <p className={styles.description}>{t('hero.description')}</p>
                        <div className={styles.heroBtns}>
                            <Link to="/visualizer" className="btn-primary">
                                {t('hero.cta')} <ArrowRight size={20} />
                            </Link>
                            <button className={styles.btnSecondary}>
                                <Smartphone size={20} /> {t('hero.download')}
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        className={styles.heroVisual}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <div className={styles.robotPlaceholder}>
                            <div className={styles.glow}></div>
                            {/* Embed YouTube video of Wall Painting Robot */}
                            <iframe
                                className={styles.heroVideo}
                                src="https://www.youtube.com/embed/ySJPj0o8l-o?autoplay=1&mute=1&loop=1&playlist=ySJPj0o8l-o&controls=0&showinfo=0&modestbranding=1"
                                title="Wall Painting Robot"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className={styles.features}>
                <div className="container">
                    <h2 className={styles.sectionTitle}>{t('features.title')}</h2>
                    <div className={styles.featureGrid}>
                        <div className={styles.featureCard}>
                            <Bluetooth className={styles.featureIcon} />
                            <h3>{t('features.bluetooth')}</h3>
                            <p>Seamless connectivity with the Vannam App for real-time control.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <Smartphone className={styles.featureIcon} />
                            <h3>{t('features.control')}</h3>
                            <p>Intuitive mobile interface to manage painting tasks remotely.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <Paintbrush className={styles.featureIcon} />
                            <h3>{t('features.painting')}</h3>
                            <p>High-precision actuators ensure a flawless finish every time.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <ShieldCheck className={styles.featureIcon} />
                            <h3>Safety First</h3>
                            <p>Eliminate risks of climbing high walls manually.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
