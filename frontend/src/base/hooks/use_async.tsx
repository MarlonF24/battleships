import { useState } from "react";

export const useAsync = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function execute<T>(asyncFn: () => Promise<T>): Promise<T> {
        setLoading(true);
        setError(null);
        try {
            return await asyncFn();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
            console.error("Error in useAsync:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, execute };
}