import { ResidentModel, PaymentModel } from './server/models.js';
import { connectToDatabase } from './server/db.js';

connectToDatabase().then(async () => {
  try {
    const resident = await ResidentModel.findOne();
    if (!resident) {
      console.log('No residents found. Please add a resident first.');
      process.exit(0);
    }
    
    console.log('Using resident:', resident.fullName, 'ID:', resident.id);
    
    // Attempt to create a payment with some undefined fields (like notes and transactionReference)
    const payment = await PaymentModel.create({
      id: `PAY-${Date.now().toString().slice(-4)}`,
      residentId: resident.id,
      residentName: resident.fullName,
      roomNumber: resident.roomNumber,
      bedNumber: resident.bedNumber,
      billingMonth: 'August 2026',
      totalDueForMonth: 8500,
      amountPaid: 8500,
      remainingBalance: 0,
      paymentType: 'Rent',
      paymentMethod: 'UPI',
      status: 'Paid',
      transactionReference: undefined, // this is what was causing the 500 error!
      notes: undefined, // this is also what was causing the 500 error!
      paidAt: new Date().toISOString(),
      recordedBy: 'Admin',
    });
    
    console.log('Payment created successfully:', payment);
    
    // Let's query it back to make sure it's saved
    const fetched = await PaymentModel.find({ residentId: resident.id });
    console.log('Fetched payments:', fetched);
    
    process.exit(0);
  } catch (err: any) {
    console.error('FAILED TO CREATE PAYMENT:', err);
    process.exit(1);
  }
});
