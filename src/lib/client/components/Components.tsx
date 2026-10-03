import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { handleClientLogout } from "@/lib/client/auth";

import { useFirebaseContext } from "@/lib/client/context/firebaseContext";

type UserData = {
    username: string;
    role?: string;
};

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("userData");

        if (stored) {
            setUserData(JSON.parse(stored) as UserData);
        }
    }, []);

    const router = useRouter();

    const { setIsFirebaseReady } = useFirebaseContext();
    async function logout() {
        setIsFirebaseReady(false);
        await handleClientLogout("/login");
        setUserData(null);
    }



    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`w-full fixed top-0 left-0 z-50 py-2 transition-all duration-500 ${scrolled ? "bg-pink-400/50 shadow-xl backdrop-blur-md " : "bg-pink-400/80 backdrop-blur-md "
                }`}
        >
            <div className="max-w-6xl mx-auto flex justify-between items-center px-4 sm:px-6">
                <h1 className={`font-bold text-white text-xl sm:text-2xl transition-all duration-300 ${scrolled ? "text-lg" : "text-2xl"}`}>
                    <Link href="/">SixSeven</Link>
                </h1>
                <nav>
                    {userData ? (
                        <details className="group relative">
                            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-white transition hover:bg-pink-500">
                                <span className="font-medium">
                                    {userData.username}
                                </span>

                                <svg
                                    className="h-4 w-4 transition-transform group-open:rotate-180"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19 9l-7 7-7-7"
                                    />
                                </svg>
                            </summary>

                            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg bg-white shadow-xl">
                                <div className="border-b px-4 py-3">
                                    <p className="text-xs text-gray-500">
                                        Logged in as
                                    </p>
                                    <p className="font-semibold text-gray-800">
                                        {userData.username}
                                    </p>
                                </div>

                                {(userData.role === "admin" || userData.role === "privileged") && (
                                    <Link
                                        href="/admin"
                                        className="block px-4 py-3 text-gray-700 hover:bg-pink-100 font-medium"
                                    >
                                        Admin Panel
                                    </Link>
                                )}

                                <Link
                                    href="/settings"
                                    className="block px-4 py-3 text-gray-700 hover:bg-pink-100"
                                >
                                    User Settings
                                </Link>

                                <button
                                    onClick={logout}
                                    className="block w-full px-4 py-3 text-left text-red-600 hover:bg-red-100"
                                >
                                    Logout
                                </button>
                            </div>
                        </details>
                    ) : (
                        <Link
                            href="/login"
                            className="flex h-10 items-center rounded-lg px-3 font-medium text-white transition hover:bg-pink-500"
                        >
                            Login
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
