import { Link } from 'react-router-dom'

/** Enlaces a los documentos legales (se abren en otra pestana). */
export function LegalLinks({ className = '' }: { className?: string }) {
  const links = [
    { to: '/legal/terminos', label: 'Terminos y condiciones' },
    { to: '/legal/privacidad', label: 'Tratamiento de datos' },
    { to: '/legal/marketplace', label: 'Reglas del marketplace' },
  ]
  return (
    <nav
      aria-label="Documentos legales"
      className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}
    >
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          target="_blank"
          rel="noopener"
          className="text-slate-500 hover:text-brand-text"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
