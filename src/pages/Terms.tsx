import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link to="/" className="font-display text-lg font-bold">Theo IA</Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
          </Button>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl py-10 px-4">
        <article className="prose prose-invert max-w-none space-y-6 text-foreground/90">
          <h1 className="text-3xl md:text-4xl font-display font-bold">Termos de Uso — Theo IA</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 16 de maio de 2026</p>

          <Section title="1. SOBRE O THEO IA">
            <p>O presente Termo de Uso regula a utilização da plataforma Theo IA, ferramenta de automação inteligente de atendimento via WhatsApp, CRM, agendamentos, gestão de leads e comunicação automatizada.</p>
            <p>O Theo IA atua como uma plataforma de atendimento digital com inteligência artificial, permitindo que empresas automatizem conversas, organizem contatos, realizem follow-up, atendimentos, agendamentos e gestão comercial.</p>
            <p>A utilização da plataforma implica na aceitação integral destes Termos de Uso.</p>
          </Section>

          <Section title="2. ACEITAÇÃO DOS TERMOS">
            <p>Ao acessar ou utilizar o Theo IA, o usuário declara:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>possuir capacidade legal para contratar os serviços;</li>
              <li>ter lido e concordado com estes Termos;</li>
              <li>utilizar a plataforma de acordo com a legislação brasileira;</li>
              <li>responsabilizar-se pelas informações fornecidas e pelas mensagens enviadas através da plataforma.</li>
            </ul>
            <p>Caso o usuário não concorde com qualquer cláusula destes Termos, não deverá utilizar o serviço.</p>
          </Section>

          <Section title="3. DESCRIÇÃO DOS SERVIÇOS">
            <p>O Theo IA disponibiliza funcionalidades como:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>atendimento automatizado via WhatsApp;</li>
              <li>respostas inteligentes com IA;</li>
              <li>integração com múltiplos números de WhatsApp;</li>
              <li>CRM estilo Kanban;</li>
              <li>organização de leads;</li>
              <li>automação de follow-up;</li>
              <li>envio e recebimento de mensagens;</li>
              <li>entendimento de áudios, imagens e documentos;</li>
              <li>agendamentos e calendário;</li>
              <li>painel de métricas;</li>
              <li>gestão de equipe;</li>
              <li>tarefas e notificações;</li>
              <li>integração com APIs e ferramentas externas;</li>
              <li>armazenamento de base de conhecimento.</li>
            </ul>
            <p>As funcionalidades podem ser alteradas, removidas, atualizadas ou ampliadas a qualquer momento.</p>
          </Section>

          <Section title="4. NATUREZA DA PLATAFORMA">
            <p>O Theo IA é uma ferramenta independente de automação, integração e gestão de atendimento digital.</p>
            <p>O usuário declara ciência de que:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>o WhatsApp pertence à Meta Platforms Inc.;</li>
              <li>o Theo IA não possui vínculo societário com WhatsApp ou Meta;</li>
              <li>determinadas funcionalidades podem depender de APIs, bibliotecas, serviços e infraestruturas de terceiros;</li>
              <li>alterações realizadas pelo WhatsApp, Meta ou fornecedores externos podem impactar funcionalidades da plataforma.</li>
            </ul>
            <p>O Theo IA poderá utilizar tecnologias de conexão por QR Code, pareamento e integrações de mensageria para viabilizar funcionalidades de automação e sincronização.</p>
            <p>Para execução dos serviços, determinadas mensagens, arquivos, mídias, registros operacionais, dados de atendimento e informações relacionadas às conversas poderão trafegar, ser processadas e armazenadas em servidores próprios ou de fornecedores parceiros de infraestrutura, hospedagem, processamento e inteligência artificial.</p>
            <p>Essas operações são necessárias para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>funcionamento da plataforma;</li>
              <li>sincronização de mensagens;</li>
              <li>automações;</li>
              <li>histórico de conversas;</li>
              <li>segurança operacional;</li>
              <li>métricas;</li>
              <li>continuidade do serviço;</li>
              <li>suporte técnico;</li>
              <li>melhoria da experiência do usuário.</li>
            </ul>
            <p>O Theo IA adota medidas razoáveis de segurança e proteção de dados compatíveis com o mercado e com a legislação aplicável.</p>
            <p>O Theo IA não garante disponibilidade contínua dos serviços de terceiros.</p>
          </Section>

          <Section title="5. CADASTRO E RESPONSABILIDADE DA CONTA">
            <p>Para utilização da plataforma poderá ser necessário:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>criar uma conta;</li>
              <li>fornecer dados empresariais;</li>
              <li>informar e-mail e telefone;</li>
              <li>conectar números de WhatsApp.</li>
            </ul>
            <p>O usuário é integralmente responsável:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>pela segurança da conta;</li>
              <li>pelas atividades realizadas em sua conta;</li>
              <li>pelo uso feito por colaboradores;</li>
              <li>pelas mensagens enviadas aos seus clientes.</li>
            </ul>
            <p>O compartilhamento de acesso é de responsabilidade exclusiva do titular da conta.</p>
          </Section>

          <Section title="6. USO ADEQUADO DA PLATAFORMA">
            <p>É proibido utilizar o Theo IA para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>envio de spam;</li>
              <li>golpes ou fraudes;</li>
              <li>práticas ilegais;</li>
              <li>disseminação de malware;</li>
              <li>assédio;</li>
              <li>envio massivo não autorizado;</li>
              <li>violação da LGPD;</li>
              <li>conteúdo ofensivo, discriminatório ou ilícito;</li>
              <li>violação de direitos de terceiros.</li>
            </ul>
            <p>O Theo IA poderá suspender ou encerrar contas que violem estes Termos.</p>
          </Section>

          <Section title="7. RESPONSABILIDADE SOBRE MENSAGENS E DADOS">
            <p>O cliente é o único responsável:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>pelo conteúdo das mensagens enviadas;</li>
              <li>pela legalidade da base de contatos utilizada;</li>
              <li>pela obtenção de consentimento dos seus clientes;</li>
              <li>pelo tratamento de dados pessoais realizado através da plataforma;</li>
              <li>pelas permissões e autorizações relacionadas aos canais conectados.</li>
            </ul>
            <p>O usuário declara ciência de que, para prestação dos serviços, mensagens, arquivos, áudios, imagens, documentos, históricos e dados operacionais poderão ser processados e armazenados temporária ou permanentemente em ambiente seguro controlado pelo Theo IA ou por fornecedores parceiros.</p>
            <p>O Theo IA atua como operador tecnológico e processador de dados dentro dos limites necessários para execução dos serviços contratados.</p>
          </Section>

          <Section title="8. DISPONIBILIDADE DOS SERVIÇOS">
            <p>O Theo IA busca manter a plataforma disponível 24 horas por dia, porém não garante disponibilidade ininterrupta.</p>
            <p>Poderão ocorrer:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>manutenções;</li>
              <li>instabilidades;</li>
              <li>interrupções temporárias;</li>
              <li>falhas decorrentes de terceiros;</li>
              <li>bloqueios ou limitações do WhatsApp;</li>
              <li>atualizações de sistema.</li>
            </ul>
            <p>O Theo IA não se responsabiliza por perdas decorrentes de indisponibilidade temporária.</p>
          </Section>

          <Section title="9. PLANOS, PAGAMENTOS E CANCELAMENTO">
            <p>O uso da plataforma poderá depender da contratação de plano pago.</p>
            <p>Os valores, limites e funcionalidades serão informados na página comercial do Theo IA.</p>
            <p>O não pagamento poderá resultar em:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>suspensão de acesso;</li>
              <li>limitação de funcionalidades;</li>
              <li>cancelamento da conta.</li>
            </ul>
            <p>O cancelamento poderá ser solicitado pelo usuário a qualquer momento, observados os prazos e condições do plano contratado.</p>
            <p>Valores já pagos não são reembolsáveis, salvo previsão legal ou oferta específica.</p>
          </Section>

          <Section title="10. PROPRIEDADE INTELECTUAL">
            <p>Todos os direitos relacionados ao Theo IA pertencem exclusivamente à plataforma, incluindo:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>marca;</li>
              <li>identidade visual;</li>
              <li>software;</li>
              <li>códigos;</li>
              <li>interface;</li>
              <li>automações;</li>
              <li>fluxos;</li>
              <li>funcionalidades;</li>
              <li>materiais institucionais.</li>
            </ul>
            <p>É proibido:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>copiar;</li>
              <li>revender;</li>
              <li>distribuir;</li>
              <li>modificar;</li>
              <li>realizar engenharia reversa;</li>
              <li>explorar comercialmente a tecnologia sem autorização.</li>
            </ul>
          </Section>

          <Section title="11. LIMITAÇÃO DE RESPONSABILIDADE">
            <p>O Theo IA não será responsável por:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>bloqueios realizados pelo WhatsApp;</li>
              <li>perda de mensagens causada por terceiros;</li>
              <li>falhas de internet;</li>
              <li>decisões tomadas com base em respostas da IA;</li>
              <li>danos indiretos;</li>
              <li>perda de faturamento;</li>
              <li>perda de leads;</li>
              <li>indisponibilidade causada por integrações externas.</li>
            </ul>
            <p>A responsabilidade máxima do Theo IA limita-se ao valor pago pelo usuário nos últimos 12 meses.</p>
          </Section>

          <Section title="12. PRIVACIDADE E PROTEÇÃO DE DADOS">
            <p>O tratamento de dados pessoais é realizado conforme a <Link to="/privacy" className="text-primary underline">Política de Privacidade</Link> do Theo IA.</p>
            <p>Ao utilizar a plataforma, o usuário declara ciência e concordância com a Política de Privacidade.</p>
          </Section>

          <Section title="13. SUSPENSÃO E ENCERRAMENTO">
            <p>O Theo IA poderá suspender ou encerrar contas em caso de:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>violação destes Termos;</li>
              <li>uso abusivo;</li>
              <li>fraude;</li>
              <li>atividades ilegais;</li>
              <li>inadimplência;</li>
              <li>riscos operacionais ou jurídicos.</li>
            </ul>
            <p>O usuário também poderá solicitar o encerramento da conta.</p>
          </Section>

          <Section title="14. ALTERAÇÕES DOS TERMOS">
            <p>O Theo IA poderá alterar estes Termos a qualquer momento.</p>
            <p>As versões atualizadas serão publicadas no site oficial.</p>
            <p>A continuidade do uso da plataforma após alterações representa concordância com os novos termos.</p>
          </Section>

          <Section title="15. LEGISLAÇÃO E FORO">
            <p>Este Termo será regido pelas leis da República Federativa do Brasil.</p>
            <p>Fica eleito o foro da comarca de Balneário Camboriú/SC, com renúncia de qualquer outro, por mais privilegiado que seja.</p>
          </Section>

          <Section title="16. CONTATO">
            <p>Para dúvidas, solicitações ou assuntos relacionados a estes Termos:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>E-mail: falecomtheoia@gmail.com</li>
              <li>Site: theoia.com.br</li>
              <li>Empresa: Wemerson Leite Oliveira</li>
              <li>CNPJ: 32.330.296/0001-03</li>
              <li>Endereço: Rua Macuco, 224, Balneário Camboriú - SC</li>
            </ul>
          </Section>
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl md:text-2xl font-display font-semibold mt-8">{title}</h2>
      <div className="space-y-3 text-sm md:text-base leading-relaxed">{children}</div>
    </section>
  );
}