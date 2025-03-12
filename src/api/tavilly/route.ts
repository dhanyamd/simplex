import { NextResponse } from "next/server";

const TAVILIY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavilly.com/search'

if (!TAVILIY_API_KEY) {
    throw new Error('TAVILY_API_')
}

export async function name(req: Request) {
    try {
        const {query, includeImages, includeImageDescription} = await req.json()

        const response = await fetch(TAVILY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': TAVILIY_API_KEY as string, 

            },
            body: JSON.stringify({
                query,
                include_answer: true,
                search_depth: "advanced",
                api_key: TAVILIY_API_KEY,
                include_images: includeImages,
                include_image_descriptions: includeImageDescription,
            })
        })
        if ( !response.ok) {
            const error = await response.json();
            console.error('Tavilly Error Response', {
                status: response.status,
                statusText: response.statusText,
                error
            })
            throw new Error(error.message || "Failed to get response from tavilly")
        }
        const data = await response.json()
        if (!data.results) {
            console.error('Invalid Tavily API response', data)
            throw new Error('Invalid response format from Tavilly api')
        }
        if(data.answer) {
            data.results.unshift({
                title: "AI Generated Answer",
                content: data.answer,
                url: "Generated from Tavily's answer",
            });
        }
        return NextResponse.json(data)
    } catch (error) {
        console.error('Tavily API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
    }
}