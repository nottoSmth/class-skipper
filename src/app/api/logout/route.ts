import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json(
        { status: 200 }
    );
    response.cookies.set({
        name: "session",
        value: "",
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    });

    return response;
}