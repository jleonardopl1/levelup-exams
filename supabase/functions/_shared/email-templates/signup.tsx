/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirme seu email no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirme seu email</Heading>
        <Text style={text}>
          Obrigado por se cadastrar no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Confirme seu email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) usando o botão abaixo:
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirmar email
        </Button>
        <Text style={footer}>
          Se você não criou uma conta, ignore este email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(222, 47%, 11%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(220, 9%, 46%)',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(221, 83%, 53%)',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid hsl(221, 83%, 53%)',
  borderRadius: '16px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: 'hsl(220, 9%, 46%)', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: hsl(221, 83%, 53%) !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: hsl(221, 83%, 53%) !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: hsl(221, 83%, 53%) !important; }
`
