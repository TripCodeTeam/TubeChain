import { motion } from "framer-motion";

function Header() {
    return (
        <motion.header 
            className="text-center mb-16 mt-20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
        >
            <motion.div 
                className="mb-2"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2 }}
            >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight">
                    <motion.span 
                        className="text-red-500 font-bold"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                    >
                        Tube
                    </motion.span>
                    <motion.span 
                        className="text-amber-500 font-thin"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                    >
                        Chain
                    </motion.span>
                </h1>
            </motion.div>
            
            <motion.p 
                className="text-slate-500 text-sm sm:text-base max-w-sm mx-auto px-4 font-light"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
            >
                Descarga videos de YouTube en alta calidad
            </motion.p>
        </motion.header>
    )
}

export default Header;