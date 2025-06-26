function ErrorMessage({ error }: { error: string }) {
    return (
        <div className="p-3 mb-8 bg-red-50 text-red-500 rounded-lg flex items-center text-sm">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-2 animate-pulse"></div>
            {error}
        </div>
    )
}

export default ErrorMessage;