"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Github, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const { scrollY } = useScroll();

    useEffect(() => {
        const unsubscribe = scrollY.onChange((latest) => {
            setIsScrolled(latest > 20);
        });
        return () => unsubscribe();
    }, [scrollY]);

    return (
        <motion.nav
            className={`fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 transition-all duration-300 ${isScrolled
                ? 'py-2 sm:py-3 backdrop-blur-md bg-white/80 border-b border-white/20'
                : 'py-4 sm:py-6 bg-transparent'
                }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="drop-shadow-md"
                >
                    <h1 className={`font-light tracking-tight transition-all duration-300 ${isScrolled ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                        }`}>
                        <span className="text-red-500 font-semibold drop-shadow-sm">Tube</span>
                        <span className="text-amber-500 font-semibold drop-shadow-sm">Chain</span>
                    </h1>
                </motion.div>

                {/* Actions */}
                <motion.button
                    className={`flex items-center gap-2 bg-transparent text-slate-700 font-light transition-all duration-200 ${isScrolled ? 'text-sm' : 'text-base'
                        } hover:bg-gray-100 px-3 py-2 rounded-md`}
                    whileTap={{ y: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ShieldCheck
                        size={isScrolled ? 14 : 16}
                        className="transition-all duration-300"
                    />
                    API
                </motion.button>
            </div>
        </motion.nav>
    )
}

export default Navbar;