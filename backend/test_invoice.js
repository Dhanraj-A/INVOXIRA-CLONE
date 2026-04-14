(async () => {
  try {
    const resLog = await fetch('http://localhost:5001/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: '8888888833', password: 'test' }) });
    const logData = await resLog.json();
    const token = logData.token;
    
    // Random string for invoice number
    const invNo = Math.random().toString();
    const invoiceData = {
      invoiceNo: invNo, date: "2026-04-08", dueDate: "", paymentType: "Cash",
      status: "pending", custSearch: "Test Customer",
      customer: null,
      items: [{ name: "Product A", qty: 1, unit: "Nos", price: 100, gstRate: 18, amount: 118 }],
      transport: 0, roundOff: 0, grandTotal: 118, received: 0,
      stateOfSupply: "Tamil Nadu", shipTo: "", poNo: "", eWayBill: "", vehicleNo: "", notes: "", termsConditions: ""
    };

    const resInv = await fetch('http://localhost:5001/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(invoiceData)
    });
    console.log("Status:", resInv.status);
    console.log(await resInv.json());
  } catch (err) {
    console.error(err);
  }
})();
