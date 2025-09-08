import prisma from '../prismaClient.js';

export const createBooking = async (req, res, next) => {
  try {
    const { consultantType, details, amount } = req.body;
    const studentId = req.student.id;

    const booking = await prisma.booking.create({
      data: {
        studentId,
        consultantType,
        details,
        amount,
        currency: 'INR'
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const studentId = req.student.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: { studentId },
        include: {
          payment: {
            select: {
              id: true,
              razorpayPaymentId: true,
              amount: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.booking.count({
        where: { studentId }
      })
    ]);

    res.json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: {
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.student.id;

    const booking = await prisma.booking.findFirst({
      where: {
        id: parseInt(id),
        studentId
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        payment: {
          select: {
            id: true,
            razorpayPaymentId: true,
            razorpayOrderId: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Booking retrieved successfully',
      data: { booking }
    });
  } catch (error) {
    next(error);
  }
};
