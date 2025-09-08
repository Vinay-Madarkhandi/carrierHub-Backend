export const createCSV = (bookings) => {
  const headers = [
    'Booking ID',
    'Student Name',
    'Student Email',
    'Student Phone',
    'Consultant Type',
    'Details',
    'Amount (₹)',
    'Status',
    'Payment ID',
    'Payment Status',
    'Created At',
    'Updated At'
  ];

  const rows = bookings.map(booking => [
    booking.id,
    booking.student.name,
    booking.student.email,
    booking.student.phone,
    booking.consultantType,
    `"${booking.details.replace(/"/g, '""')}"`, // Escape quotes in details
    (booking.amount / 100).toFixed(2), // Convert paise to rupees
    booking.status,
    booking.payment?.razorpayPaymentId || 'N/A',
    booking.payment?.status || 'N/A',
    booking.createdAt.toISOString(),
    booking.updatedAt.toISOString()
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');

  return csvContent;
};
