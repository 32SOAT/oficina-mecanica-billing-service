export function paginaCheckout(input: {
  osId: string;
  valor: string;
  publicKey: string;
  status: string;
  aguardandoRetorno: boolean;
}): string {
  const osId = JSON.stringify(input.osId);
  const valor = JSON.stringify(Number(input.valor));
  const publicKey = JSON.stringify(input.publicKey);
  const aviso =
    input.status === 'RECUSADO'
      ? 'Pagamento recusado. Tente novamente.'
      : input.aguardandoRetorno
        ? 'Pagamento pendente. Aguardando o retorno do Mercado Pago.'
        : '';
  if (input.status === 'APROVADO') {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pagamento da ordem</title>
</head>
<body>
  <h1>Pagamento da retirada</h1>
  <p>Ordem ${input.osId}. Valor R$ ${input.valor}.</p>
  <p>Esta ordem já está paga.</p>
</body>
</html>`;
  }
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pagamento da ordem</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <h1>Pagamento da retirada</h1>
  <p>Ordem ${input.osId}. Valor R$ ${input.valor}.</p>
  <div id="cardPaymentBrick_container"></div>
  <p id="resultado">${aviso}</p>
  <script>
    const osId = ${osId};
    const amount = ${valor};
    const publicKey = ${publicKey};
    const resultado = document.getElementById('resultado');
    function mostrar(texto) {
      resultado.textContent = texto;
    }
    const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
    mp.bricks()
      .create('cardPayment', 'cardPaymentBrick_container', {
        initialization: { amount: amount },
        callbacks: {
          onReady: function () {},
          onSubmit: function (formData) {
            return fetch('/api/v1/pagamentos/' + osId + '/cobrar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(formData),
            }).then(function (response) {
              return response.json().then(function (body) {
                if (!response.ok) {
                  var message = body.message || 'Não foi possível cobrar';
                  mostrar(message);
                  throw new Error(message);
                }
                if (body.data.status === 'PENDENTE') {
                  mostrar(
                    'Pagamento pendente. Aguardando o retorno do Mercado Pago.',
                  );
                } else if (body.data.status === 'RECUSADO') {
                  mostrar('Pagamento recusado. Tente novamente.');
                } else {
                  mostrar('Pagamento ' + body.data.status);
                }
                if (body.data.status === 'APROVADO') {
                  var formulario = document.getElementById(
                    'cardPaymentBrick_container',
                  );
                  if (formulario) formulario.remove();
                }
              });
            });
          },
          onError: function (error) {
            mostrar(
              (error && error.message) ||
                'Não foi possível abrir o formulário do cartão',
            );
          },
        },
      })
      .then(function (controller) {
        if (!controller) {
          mostrar(
            'A Public Key não foi reconhecida pelo Mercado Pago. Confira MERCADOPAGO_PUBLIC_KEY no billing.',
          );
        }
      })
      .catch(function (error) {
        mostrar(
          (error && error.message) ||
            'Não foi possível abrir o formulário do cartão',
        );
      });
  </script>
</body>
</html>`;
}
