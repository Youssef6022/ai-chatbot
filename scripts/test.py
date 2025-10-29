from google import genai
from google.genai import types
import base64
import os
import json

# les credentials
GOOGLE_GENERATIVE_AI_API_KEY= "AIzaSyCfC4oHEDsejuxZkTc2SAhGgG3tlZMm8o8"

def generate():
  client = genai.Client(
        vertexai=True,
        # api_key=GOOGLE_GENERATIVE_AI_API_KEY,
        project="total-apparatus-451215-g1",
        location="europe-west3"
  )


  model = "gemini-2.5-flash"
  contents = [
    types.Content(
      role="user",
      parts=[
        types.Part.from_text(text="""donne moi chapitre 4, section 3, paragraphe 1""")
      ]
    ),
  ]
  tools = [
    types.Tool(
      retrieval=types.Retrieval(
        vertex_rag_store=types.VertexRagStore(
          rag_resources=[
            types.VertexRagStoreRagResource(
              rag_corpus="projects/total-apparatus-451215-g1/locations/europe-west3/ragCorpora/3379951520341557248"
            )
          ],
          similarity_top_k=20,
        )
      )
    )
  ]

  generate_content_config = types.GenerateContentConfig(
    temperature = 1,
    top_p = 0.95,
    max_output_tokens = 65535,
    safety_settings = [types.SafetySetting(
      category="HARM_CATEGORY_HATE_SPEECH",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold="OFF"
    ),types.SafetySetting(
      category="HARM_CATEGORY_HARASSMENT",
      threshold="OFF"
    )],
    tools = tools,
    thinking_config=types.ThinkingConfig(
      thinking_budget=-1,
    ),
  )

  for chunk in client.models.generate_content_stream(
    model = model,
    contents = contents,
    config = generate_content_config,
    ):
    if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
        continue
    print(chunk.text, end="")

generate()