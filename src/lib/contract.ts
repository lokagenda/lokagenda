export function replaceVariables(
  template: string,
  data: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

export function getDefaultTemplate(): string {
  return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="font-size: 24px; margin-bottom: 5px;">{{nome_empresa}}</h1>
    <p style="font-size: 14px; color: #666;">CNPJ/CPF: {{cnpj_empresa}} | Tel: {{telefone_empresa}}</p>
  </div>

  <h2 style="text-align: center; font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">CONTRATO DE LOCAÇÃO DE BRINQUEDOS E EQUIPAMENTOS</h2>

  <p style="margin-top: 20px; line-height: 1.8;">
    Pelo presente instrumento particular, de um lado <strong>{{nome_empresa}}</strong>, inscrita no CNPJ/CPF sob o n. {{cnpj_empresa}}, doravante denominada <strong>LOCADORA</strong>, e de outro lado <strong>{{nome_cliente}}</strong>, portador(a) do CPF n. {{cpf_cliente}}, telefone {{telefone_cliente}}, e-mail {{email_cliente}}, doravante denominado(a) <strong>LOCATÁRIO(A)</strong>, firmam o presente contrato de locação mediante as cláusulas e condições abaixo:
  </p>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 1 - DO OBJETO</h3>
  <p style="line-height: 1.8;">
    O presente contrato tem por objeto a locação dos seguintes itens:
  </p>
  <div style="margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 5px;">
    {{itens_locacao}}
  </div>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 2 - DO EVENTO</h3>
  <p style="line-height: 1.8;">
    Os itens serão entregues no endereço: <strong>{{endereco_evento}}</strong><br/>
    Data do evento: <strong>{{data_evento}}</strong><br/>
    Horário de entrega/montagem: <strong>{{horario_entrega}}</strong><br/>
    Horário de retirada/desmontagem: <strong>{{horario_retirada}}</strong>
  </p>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 3 - DO VALOR</h3>
  <p style="line-height: 1.8;">
    O valor total da locação é de <strong>{{valor_total}}</strong>.
    Desconto aplicado: <strong>{{valor_desconto}}</strong>.
  </p>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 4 - DAS RESPONSABILIDADES DO LOCATÁRIO</h3>
  <p style="line-height: 1.8;">
    O(A) LOCATÁRIO(A) se compromete a:<br/>
    a) Zelar pela conservação dos equipamentos locados;<br/>
    b) Não sublocar, ceder ou transferir os itens a terceiros;<br/>
    c) Devolver os equipamentos nas mesmas condições em que foram recebidos;<br/>
    d) Responsabilizar-se por quaisquer danos, perdas ou extravios ocorridos durante o período de locação.
  </p>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 5 - DO CANCELAMENTO</h3>
  <p style="line-height: 1.8;">
    Em caso de cancelamento por parte do(a) LOCATÁRIO(A), deverá ser comunicado com antecedência mínima de 48 horas. Cancelamentos fora deste prazo estarão sujeitos a cobrança de 50% do valor total.
  </p>

  <h3 style="margin-top: 25px; font-size: 16px;">CLÁUSULA 6 - DO FORO</h3>
  <p style="line-height: 1.8;">
    Para dirimir quaisquer controversias oriundas deste contrato, as partes elegem o foro da comarca onde se situa a LOCADORA.
  </p>

  <p style="margin-top: 30px; line-height: 1.8;">
    E por estarem assim justas e contratadas, as partes firmam o presente instrumento em duas vias de igual teor e forma.
  </p>

  <p style="margin-top: 20px;">Data: {{data_atual}}</p>

  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #333; padding-top: 10px;">
        <strong>LOCADORA</strong><br/>
        {{nome_empresa}}
      </div>
    </div>
    <div style="text-align: center; width: 45%;">
      <div style="border-top: 1px solid #333; padding-top: 10px;">
        <strong>LOCATÁRIO(A)</strong><br/>
        {{nome_cliente}}
      </div>
    </div>
  </div>
</div>`
}

export function getSampleData(): Record<string, string> {
  return {
    nome_cliente: 'Maria da Silva',
    cpf_cliente: '123.456.789-00',
    telefone_cliente: '(11) 99999-8888',
    email_cliente: 'maria@exemplo.com',
    endereco_evento: 'Rua das Flores, 123 - Jardim Primavera',
    data_evento: '25/03/2026',
    horario_entrega: '08:00',
    horario_retirada: '18:00',
    itens_locacao: '2x Cama Elástica Grande - R$ 200,00<br/>1x Piscina de Bolinhas - R$ 150,00<br/>1x Tobogã Inflável - R$ 180,00',
    valor_total: 'R$ 530,00',
    valor_desconto: 'R$ 0,00',
    nome_empresa: 'Festas Divertidas LTDA',
    telefone_empresa: '(11) 3333-4444',
    cnpj_empresa: '12.345.678/0001-99',
    data_atual: '21/03/2026',
  }
}
