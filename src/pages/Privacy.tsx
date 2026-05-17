import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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
          <h1 className="text-3xl md:text-4xl font-display font-bold">Política de Privacidade — Theo IA</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 16 de maio de 2026</p>

          <Section title="1. INTRODUÇÃO">
            <p>A presente Política de Privacidade descreve como o Theo IA coleta, utiliza, armazena, compartilha e protege os dados pessoais dos usuários da plataforma.</p>
            <p>O Theo IA respeita a privacidade dos usuários e atua em conformidade com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018);</li>
              <li>Marco Civil da Internet;</li>
              <li>demais normas aplicáveis.</li>
            </ul>
            <p>Ao utilizar o Theo IA, o usuário concorda com esta Política.</p>
          </Section>

          <Section title="2. DADOS COLETADOS">
            <p>O Theo IA poderá coletar os seguintes dados:</p>
            <h3 className="text-lg font-semibold mt-4">2.1 Dados de cadastro</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>nome;</li>
              <li>e-mail;</li>
              <li>telefone;</li>
              <li>empresa;</li>
              <li>CPF ou CNPJ;</li>
              <li>endereço;</li>
              <li>informações de pagamento.</li>
            </ul>
            <h3 className="text-lg font-semibold mt-4">2.2 Dados operacionais</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>mensagens trocadas;</li>
              <li>histórico de atendimento;</li>
              <li>contatos cadastrados;</li>
              <li>arquivos enviados;</li>
              <li>áudios;</li>
              <li>imagens;</li>
              <li>documentos;</li>
              <li>registros de acesso;</li>
              <li>IP;</li>
              <li>logs de utilização.</li>
            </ul>
            <h3 className="text-lg font-semibold mt-4">2.3 Dados de integração</h3>
            <p>Dados oriundos de integrações com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>WhatsApp;</li>
              <li>Meta;</li>
              <li>APIs externas;</li>
              <li>CRMs;</li>
              <li>plataformas de pagamento;</li>
              <li>ferramentas de automação.</li>
            </ul>
          </Section>

          <Section title="3. FINALIDADE DO USO DOS DADOS">
            <p>Os dados poderão ser utilizados para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>prestação dos serviços;</li>
              <li>autenticação de acesso;</li>
              <li>automação de atendimento;</li>
              <li>melhoria da plataforma;</li>
              <li>suporte técnico;</li>
              <li>cobrança;</li>
              <li>segurança;</li>
              <li>prevenção a fraudes;</li>
              <li>cumprimento de obrigações legais;</li>
              <li>comunicação com usuários;</li>
              <li>análises estatísticas;</li>
              <li>treinamento e melhoria dos recursos de IA.</li>
            </ul>
          </Section>

          <Section title="4. BASE LEGAL">
            <p>O tratamento de dados poderá ocorrer com fundamento em:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>consentimento;</li>
              <li>execução contratual;</li>
              <li>legítimo interesse;</li>
              <li>cumprimento de obrigação legal;</li>
              <li>exercício regular de direitos.</li>
            </ul>
          </Section>

          <Section title="5. COMPARTILHAMENTO DE DADOS">
            <p>O Theo IA poderá compartilhar dados com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>provedores de hospedagem;</li>
              <li>serviços de pagamento;</li>
              <li>plataformas de mensageria;</li>
              <li>fornecedores de tecnologia;</li>
              <li>parceiros de infraestrutura;</li>
              <li>autoridades públicas quando exigido por lei.</li>
            </ul>
            <p>O compartilhamento ocorrerá apenas quando necessário.</p>
          </Section>

          <Section title="6. RESPONSABILIDADE DO CLIENTE SOBRE DADOS DE TERCEIROS">
            <p>O cliente declara possuir autorização legal para tratar os dados de seus contatos, leads e clientes dentro da plataforma.</p>
            <p>O Theo IA não é responsável pela origem da base de contatos utilizada pelo cliente.</p>
          </Section>

          <Section title="7. ARMAZENAMENTO E SEGURANÇA">
            <p>O Theo IA adota medidas técnicas, administrativas e organizacionais para proteger os dados contra:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>acessos não autorizados;</li>
              <li>perda;</li>
              <li>destruição;</li>
              <li>vazamento;</li>
              <li>alteração indevida.</li>
            </ul>
            <p>Os dados poderão ser armazenados em servidores próprios ou de parceiros tecnológicos nacionais e internacionais utilizados para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>hospedagem;</li>
              <li>processamento;</li>
              <li>backups;</li>
              <li>sincronização;</li>
              <li>inteligência artificial;</li>
              <li>continuidade operacional;</li>
              <li>monitoramento;</li>
              <li>segurança.</li>
            </ul>
            <p>Para viabilizar funcionalidades de automação, integração e histórico de atendimento, determinadas informações trafegadas na plataforma poderão permanecer registradas durante o período necessário à prestação dos serviços, cumprimento de obrigações legais, suporte técnico, auditoria, segurança e integridade operacional.</p>
            <p>Apesar das medidas de segurança adotadas, nenhum sistema é completamente inviolável.</p>
          </Section>

          <Section title="8. RETENÇÃO DOS DADOS">
            <p>Os dados serão armazenados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>enquanto durar a relação contratual;</li>
              <li>pelo período necessário para cumprimento de obrigações legais;</li>
              <li>até solicitação válida de exclusão;</li>
              <li>conforme exigências regulatórias.</li>
            </ul>
          </Section>

          <Section title="9. DIREITOS DO TITULAR DOS DADOS">
            <p>Nos termos da LGPD, o usuário poderá solicitar:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>confirmação da existência de tratamento;</li>
              <li>acesso aos dados;</li>
              <li>correção;</li>
              <li>anonimização;</li>
              <li>bloqueio;</li>
              <li>portabilidade;</li>
              <li>eliminação;</li>
              <li>revogação do consentimento.</li>
            </ul>
            <p>As solicitações poderão ser feitas através do canal oficial de atendimento.</p>
          </Section>

          <Section title="10. COOKIES E TECNOLOGIAS DE RASTREAMENTO">
            <p>O Theo IA poderá utilizar cookies para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>autenticação;</li>
              <li>segurança;</li>
              <li>métricas;</li>
              <li>desempenho;</li>
              <li>personalização da experiência.</li>
            </ul>
            <p>O usuário poderá gerenciar cookies no navegador.</p>
          </Section>

          <Section title="11. TRANSFERÊNCIA INTERNACIONAL DE DADOS">
            <p>Alguns dados poderão ser processados ou armazenados fora do Brasil, inclusive por fornecedores internacionais de infraestrutura e IA.</p>
            <p>Nesses casos, o Theo IA adotará medidas compatíveis com a LGPD.</p>
          </Section>

          <Section title="12. USO DE INTELIGÊNCIA ARTIFICIAL">
            <p>O Theo IA utiliza tecnologias de inteligência artificial para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>interpretação de mensagens;</li>
              <li>geração de respostas;</li>
              <li>automações;</li>
              <li>transcrição de áudio;</li>
              <li>análise de conteúdos.</li>
            </ul>
            <p>As respostas geradas pela IA podem conter limitações e devem ser supervisionadas pelo usuário.</p>
          </Section>

          <Section title="13. MENORES DE IDADE">
            <p>A plataforma não é destinada a menores de 18 anos.</p>
            <p>Caso seja identificado tratamento indevido de dados de menores, medidas poderão ser adotadas para exclusão das informações.</p>
          </Section>

          <Section title="14. ALTERAÇÕES DA POLÍTICA">
            <p>Esta Política poderá ser alterada a qualquer momento.</p>
            <p>A versão atualizada será disponibilizada no site oficial do Theo IA.</p>
          </Section>

          <Section title="15. CONTATO E ENCARREGADO LGPD">
            <p>Para assuntos relacionados à privacidade e proteção de dados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>E-mail: falecomtheoia@gmail.com</li>
              <li>Encarregado LGPD (DPO): Wemerson Leite Oliveira</li>
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