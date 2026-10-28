export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Sistema de Atualização Cadastral</h1>
        <p className="text-gray-600 mb-4">Sistema funcionando!</p>
        <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Ir para Login
        </a>
      </div>
    </div>
  )
}
