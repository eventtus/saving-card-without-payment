var stripeElements = function (publicKey, setupIntent) {
  var stripe = Stripe(publicKey);
  var elements = stripe.elements();

  // Element styles
  var style = {
    base: {
      fontSize: "16px",
      color: "#32325d",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      fontSmoothing: "antialiased",
      "::placeholder": {
        color: "rgba(0,0,0,0.4)",
      },
    },
  };

  var card = elements.create("card", { style: style });

  card.mount("#card-element");

  // Element focus ring
  card.on("focus", function () {
    var el = document.getElementById("card-element");
    el.classList.add("focused");
  });

  card.on("blur", function () {
    var el = document.getElementById("card-element");
    el.classList.remove("focused");
  });

  // Handle payment submission when user clicks the pay button.
  var button = document.getElementById("submit");
  button.addEventListener("click", function (event) {
    event.preventDefault();
    changeLoadingState(true);
    var email = document.getElementById("email").value;

    stripe
      .confirmCardSetup(setupIntent.client_secret, {
        payment_method: {
          card: card,
          billing_details: { email: email },
        },
      })
      .then(function (result) {
        if (result.error) {
          changeLoadingState(false);
          var displayError = document.getElementById("card-errors");
          displayError.textContent = result.error.message;
        } else {
          // The PaymentMethod was successfully set up
          orderComplete(stripe, setupIntent.client_secret);

          // Refresh payment methods
          getPaymentMethods();
        }
      });
  });

  // Handle payment submission when user clicks the pay button.
  var button = document.getElementById("pay");
  button.addEventListener("click", function (event) {
    event.preventDefault();
    changeLoadingState2(true);

    const payWith = selectedPaymentMethod();

    pay(payWith).then(function (response) {
      console.log("[Done]", response);
      changeLoadingState2(false);
    });
  });
};

var getSetupIntent = function (publicKey) {
  return fetch("http://localhost:4242/create-setup-intent", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (setupIntent) {
      stripeElements(publicKey, setupIntent);
    });
};

var getPublicKey = function () {
  return fetch("http://localhost:4242/public-key", {
    method: "get",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (response) {
      getSetupIntent(response.publicKey);
    });
};

// Show a spinner on payment submission
var changeLoadingState = function (isLoading) {
  if (isLoading) {
    document.querySelector("button").disabled = true;
    document.querySelector("#spinner").classList.remove("hidden");
    document.querySelector("#button-text").classList.add("hidden");
  } else {
    document.querySelector("button").disabled = false;
    document.querySelector("#spinner").classList.add("hidden");
    document.querySelector("#button-text").classList.remove("hidden");
  }
};

// Show a spinner on payment submission
var changeLoadingState2 = function (isLoading) {
  if (isLoading) {
    document.querySelector("#pay").disabled = true;
    document.querySelector("#pay-spinner").classList.remove("hidden");
    document.querySelector("#pay-button-text").classList.add("hidden");
  } else {
    document.querySelector("#pay").disabled = false;
    document.querySelector("#pay-spinner").classList.add("hidden");
    document.querySelector("#pay-button-text").classList.remove("hidden");
  }
};

/* Shows a success / error message when the payment is complete */
var orderComplete = function (stripe, clientSecret) {
  stripe.retrieveSetupIntent(clientSecret).then(function (result) {
    var setupIntent = result.setupIntent;
    var setupIntentJson = JSON.stringify(setupIntent, null, 2);

    document.querySelector(".sr-payment-form").classList.add("hidden");
    document.querySelector(".sr-result").classList.remove("hidden");
    document.querySelector("pre").textContent = setupIntentJson;
    setTimeout(function () {
      document.querySelector(".sr-result").classList.add("expand");
    }, 200);

    changeLoadingState(false);
  });
};

function selectedPaymentMethod() {
  var ele = document.getElementsByName("payment-method");

  for (i = 0; i < ele.length; i++) {
    if (ele[i].checked)
      return ele[i].value;
  }

  return null;
}

var getPaymentMethods = function () {
  return fetch("http://localhost:4242/payment-methods", {
    method: "get",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(function (response) {
      return response.json();
    })
    .then(function (response) {
      onPaymentMethodsFetched(response.paymentMethods);
    });
};

var pay = function (payWith) {
  return createInvoiceItem()
    .then(function (response) {
      console.log("[Create Invoice Item]", response);
      return createInvoice();
    })
    .then(function (response) {
      console.log("[Create Invoice]", response);
      return finalizeInvoice(response.id);
    })
    .then(function (response) {
      console.log("[Finalize Invoice]", response);
      return payInvoice(response.id, payWith);
    })
    .then(function (response) {
      console.log("[Pay Invoice]", response);
      return response;
    });
};

var createInvoiceItem = function () {
  return fetch("http://localhost:4242/create-invoice-item", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(function (response) {
    return response.json();
  });
};

var createInvoice = function () {
  return fetch("http://localhost:4242/create-invoice", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
  }).then(function (response) {
    return response.json();
  });
};

var finalizeInvoice = function (invoiceId) {
  return fetch("http://localhost:4242/finalize-invoice", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoiceId: invoiceId,
    }),
  }).then(function (response) {
    return response.json();
  });
};

var payInvoice = function (invoiceId, payWith) {
  return fetch("http://localhost:4242/pay-invoice", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoiceId: invoiceId,
      payWith: payWith
    }),
  }).then(function (response) {
    return response.json();
  });
};

/* Shows a list of payment methods */
var onPaymentMethodsFetched = function (paymentMethods) {
  var ul = document.getElementById("payment-methods-list");

  // Empty payments methods list
  while(ul.firstChild) ul.removeChild(ul.firstChild);
  
  paymentMethods.forEach((element) => {
    var li = document.createElement("li");

    // creating radio element
    var radio = document.createElement("input");

    // Assigning the attributes to created radio
    radio.type = "radio";
    radio.name = "payment-method";
    radio.value = element.id;
    radio.id = `radio-${element.id}`;
    radio.defaultChecked = true;

    // creating label for radio
    var label = document.createElement("label");

    // assigning attributes for the created label tag
    label.htmlFor = `radio-${element.id}`;

    // appending the created text to the created label tag
    label.appendChild(document.createTextNode(element.id));

    // Appending radio and label to li
    li.appendChild(radio);
    li.appendChild(label);

    // Appending to list
    ul.appendChild(li);
  });
};

getPublicKey();
getPaymentMethods();
