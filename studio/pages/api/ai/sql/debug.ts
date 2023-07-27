import { SchemaBuilder } from '@serafin/schema-builder'
import { codeBlock, stripIndent } from 'common-tags'
import apiWrapper from 'lib/api/apiWrapper'
import { NextApiRequest, NextApiResponse } from 'next'
import type {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
  ErrorResponse,
} from 'openai'

const openAiKey = process.env.OPENAI_KEY

const debugSqlSchema = SchemaBuilder.emptySchema()
  .addString('solution', {
    description: 'A short suggested solution for the error (as concise as possible).',
  })
  .addString('sql', {
    description: 'The SQL rewritten to apply the solution. Includes all the original SQL.',
  })

type DebugSqlResult = typeof debugSqlSchema.T

const completionFunctions = {
  debugSql: {
    name: 'debugSql',
    description: stripIndent`
      Debugs a Postgres SQL error and modifies the SQL to fix it.
      - Create extensions if they are missing (only for valid extensions)
    `,
    parameters: debugSqlSchema.schema,
  },
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!openAiKey) {
    return res.status(500).json({
      error: 'No OPENAI_KEY set. Create this environment variable to use AI features.',
    })
  }

  const { method } = req

  switch (method) {
    case 'POST':
      return handlePost(req, res)
    default:
      res.setHeader('Allow', ['POST'])
      res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } })
  }
}

export async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const {
    body: { errorMessage, sql, entityDefinitions },
  } = req

  const model = 'gpt-3.5-turbo-0613'
  const maxCompletionTokenCount = 2048

  const completionMessages: ChatCompletionRequestMessage[] = []

  if (entityDefinitions?.length > 0) {
    completionMessages.push({
      role: 'user',
      content: codeBlock`
        Here is my database schema for reference:
        ${entityDefinitions.join('\n\n')}
      `,
    })
  }

  completionMessages.push(
    {
      role: 'user',
      content: stripIndent`
        Here is my current SQL:
        ${sql}
      `,
    },
    {
      role: 'user',
      content: stripIndent`
        Here is the error I am getting:
        ${errorMessage}
      `,
    }
  )

  const completionOptions: CreateChatCompletionRequest = {
    model,
    messages: completionMessages,
    max_tokens: maxCompletionTokenCount,
    temperature: 0,
    function_call: {
      name: completionFunctions.debugSql.name,
    },
    functions: [completionFunctions.debugSql],
    stream: false,
  }

  console.log({ sql, completionMessages })

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(completionOptions),
  })

  if (!response.ok) {
    const errorResponse: ErrorResponse = await response.json()
    console.log({ errorResponse })
    console.error(`AI SQL debugging failed: ${errorResponse.error.message}`)

    return res.status(500).json({
      error: 'There was an unknown error debugging the SQL snippet. Please try again.',
    })
  }

  const completionResponse: CreateChatCompletionResponse = await response.json()

  console.log(completionResponse)

  const [firstChoice] = completionResponse.choices

  const sqlResponseString = firstChoice.message?.function_call?.arguments

  if (!sqlResponseString) {
    console.error(
      `AI SQL debugging failed: OpenAI response succeeded, but response format was incorrect`
    )

    return res.status(500).json({
      error: 'There was an unknown error debugging the SQL snippet. Please try again.',
    })
  }

  console.log({ sqlResponseString })

  const debugSqlResult: DebugSqlResult = JSON.parse(sqlResponseString)

  if (!debugSqlResult.sql) {
    console.error(`AI SQL debugging failed: Unable to debug SQL for the given error message`)

    return res.status(400).json({
      error: 'Unable to debug SQL',
    })
  }

  return res.json(debugSqlResult)
}

const wrapper = (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

export default wrapper