// A versão do texto de privacidade que está no ar.
//
// O consentimento é gravado COM a versão (tabela `consentimentos`, script
// 038). Quando o texto mudar, esta constante muda junto — e aí dá para saber
// quem aceitou o quê e pedir de novo só a quem viu a versão antiga.
//
// ⚠️ "rascunho-1" é proposital: o texto ainda é PROVISÓRIO. Ele depende do
// nome da marca e de revisão jurídica, e as duas coisas estão pendentes.
// Trocar para "1.0" só quando o documento for de verdade.
export const VERSAO_POLITICA = "rascunho-1";
