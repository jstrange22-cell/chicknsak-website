import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowRight } from 'lucide-react';
export default function CheckoutCancelPage() {
  return (
    <div className="pt-8 pb-20 px-4 min-h-screen flex items-center justify-center">
      <motion.div
        className="text-center max-w-lg mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <XCircle className="h-24 w-24 text-brand-muted mx-auto mb-6" />

        <h1 className="font-heading text-4xl sm:text-5xl font-bold uppercase text-white">
          Checkout <span className="text-brand-muted">Cancelled</span>
        </h1>
        <p className="text-brand-muted text-lg mt-4">
          No worries — your cart is still saved. Come back whenever you're ready
          to bring the heat home.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link
            to="/shop"
            className="inline-flex items-center justify-center gap-2 h-14 px-8 text-base font-semibold uppercase tracking-wider bg-brand-gold text-black hover:bg-brand-gold-dark rounded-lg transition-all duration-200"
          >
            Back to Shop
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold uppercase tracking-wider border-2 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-black rounded-lg transition-all duration-200"
          >
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
