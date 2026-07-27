// Dedicated minimal layout for print page — no header, sidebar, or nav
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, padding: 0, background: '#ffffff' }}>
        {children}
      </body>
    </html>
  )
}
