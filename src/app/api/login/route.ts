// app/api/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getFirestoreDB } from "@/lib/server/server.firebaseInterface";
import { SignJWT } from "jose";


export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const db = getFirestoreDB();

    const userDoc = await db.collection("users").doc(username).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const userData = userDoc.data();
    const role = userData?.role || "user";

    const authDoc = await db
      .collection("users")
      .doc(username)
      .collection("protected")
      .doc("auth")
      .get();

    if (!authDoc.exists) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const auth = authDoc.data()!;

    const valid = await bcrypt.compare(password, auth.password);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    const secret = process.env.JWT_SECRET;
    const secretKey = new TextEncoder().encode(secret);

    const token = await new SignJWT({ username })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1d")
      .sign(secretKey);

    const response = NextResponse.json(
      { username: username, role: role },
      { status: 200, }
    );
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
