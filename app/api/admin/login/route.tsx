import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { ethers } from "ethers";
import { ADMIN_ADDRESS } from "@/config/contract";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    "your-super-secret-jwt-key-change-this-in-production"
);

export async function POST(request: NextRequest) {
  try {
    const { address, signature, message } = await request.json();

    if (!address || !signature || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Check if address is admin
    if (address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized: Not an admin address" },
        { status: 403 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({ address, role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    return NextResponse.json({ token, address });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
